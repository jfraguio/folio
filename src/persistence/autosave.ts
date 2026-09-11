export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

export type SaveErrorKind = 'permission' | 'not-found' | 'unsupported' | 'unknown';

export interface AutosaveIO {
  /** Devuelve mtime actual del archivo en disco. */
  mtime(): Promise<number>;
  /** Escribe y devuelve el nuevo mtime. */
  write(text: string): Promise<number>;
}

export interface AutosaveOptions {
  getText: () => string;
  io: AutosaveIO;
  initialMtime: number;
  debounceMs?: number;
  periodicMs?: number;
  maxRetryMs?: number;
  onState?: (state: SaveState, info: { error?: SaveErrorKind; lastSaved?: number }) => void;
  onConflict?: (diskMtime: number) => void;
  onError?: (kind: SaveErrorKind, error: unknown) => void;
  now?: () => number;
}

export function classifyError(e: unknown): SaveErrorKind {
  if (e instanceof DOMException || (typeof e === 'object' && e && 'name' in e)) {
    const name = (e as { name: string }).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission';
    if (name === 'NotFoundError') return 'not-found';
    if (name === 'NotSupportedError') return 'unsupported';
  }
  return 'unknown';
}

/**
 * Máquina de estados del guardado automático.
 *
 * idle → dirty → (debounce) → saving → saved
 *                                   ↘ error (reintento exponencial)
 *                                   ↘ conflict (mtime en disco distinto al conocido)
 */
export class Autosave {
  state: SaveState = 'idle';
  lastKnownMtime: number;
  lastSavedAt: number | null = null;
  lastError: SaveErrorKind | undefined;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private periodicTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryMs = 2000;
  private pendingAgain = false;
  private lastSavedText: string | null = null;
  private disposed = false;

  private readonly debounceMs: number;
  private readonly periodicMs: number;
  private readonly maxRetryMs: number;
  private readonly now: () => number;

  constructor(private readonly opts: AutosaveOptions) {
    this.lastKnownMtime = opts.initialMtime;
    this.debounceMs = opts.debounceMs ?? 1500;
    this.periodicMs = opts.periodicMs ?? 30_000;
    this.maxRetryMs = opts.maxRetryMs ?? 60_000;
    this.now = opts.now ?? Date.now;
  }

  /** Llamar tras cada cambio del documento. */
  markDirty(): void {
    if (this.disposed) return;
    if (this.state === 'conflict') return; // en conflicto no se escribe; el borrador vivo protege
    if (this.state === 'saving') {
      this.pendingAgain = true;
      return;
    }
    this.setState('dirty');
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.flush(), this.debounceMs);
    if (!this.periodicTimer) {
      this.periodicTimer = setTimeout(() => {
        this.periodicTimer = null;
        if (this.state === 'dirty') void this.flush();
      }, this.periodicMs);
    }
  }

  /** Fuerza una escritura inmediata si hay cambios. */
  async flush(): Promise<void> {
    if (this.disposed) return;
    this.clearTimer('debounce');
    if (this.state === 'saving') {
      this.pendingAgain = true;
      return;
    }
    if (this.state === 'conflict') return;
    const text = this.opts.getText();
    if (this.state !== 'error' && text === this.lastSavedText) {
      if (this.state === 'dirty') this.setState('saved');
      return;
    }
    await this.doWrite(text);
  }

  /** Tras resolver un conflicto conservando la versión local: se sobrescribe sin comprobar el mtime. */
  async overwrite(): Promise<void> {
    this.setState('dirty');
    await this.doWrite(this.opts.getText(), { skipConflictCheck: true });
  }

  /** Tras cargar la versión del disco o tras "guardar como": se acepta el mtime dado. */
  accept(mtime: number, text: string): void {
    this.lastKnownMtime = mtime;
    this.lastSavedText = text;
    this.lastSavedAt = this.now();
    this.pendingAgain = false;
    this.clearTimer('retry');
    this.setState('saved');
  }

  /** Reintento manual (por ejemplo tras recuperar permisos con gesto de usuario). */
  async retry(): Promise<void> {
    this.clearTimer('retry');
    this.retryMs = 2000;
    await this.doWrite(this.opts.getText());
  }

  get isDirty(): boolean {
    return this.state === 'dirty' || this.state === 'saving' || this.state === 'error' || this.pendingAgain;
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer('debounce');
    this.clearTimer('periodic');
    this.clearTimer('retry');
  }

  private async doWrite(text: string, o: { skipConflictCheck?: boolean } = {}): Promise<void> {
    if (this.disposed) return;
    this.setState('saving');
    try {
      if (!o.skipConflictCheck) {
        const diskMtime = await this.opts.io.mtime();
        if (diskMtime !== this.lastKnownMtime) {
          this.setState('conflict');
          this.opts.onConflict?.(diskMtime);
          return;
        }
      }
      const mtime = await this.opts.io.write(text);
      this.lastKnownMtime = mtime;
      this.lastSavedText = text;
      this.lastSavedAt = this.now();
      this.retryMs = 2000;
      this.lastError = undefined;
      this.setState('saved');
    } catch (e) {
      const kind = classifyError(e);
      this.lastError = kind;
      this.setState('error');
      this.opts.onError?.(kind, e);
      if (kind === 'unknown') this.scheduleRetry();
      return;
    }
    if (this.pendingAgain) {
      this.pendingAgain = false;
      this.markDirty();
    }
  }

  private scheduleRetry(): void {
    this.clearTimer('retry');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.doWrite(this.opts.getText());
    }, this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, this.maxRetryMs);
  }

  private clearTimer(which: 'debounce' | 'periodic' | 'retry'): void {
    const key = `${which}Timer` as const;
    const t = this[key];
    if (t) clearTimeout(t);
    this[key] = null;
  }

  private setState(s: SaveState): void {
    this.state = s;
    this.opts.onState?.(s, { error: this.lastError, lastSaved: this.lastSavedAt ?? undefined });
  }
}
