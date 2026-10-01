import { getDB, type DraftRecord } from './db';

const DEBOUNCE_MS = 300;

/**
 * Borrador vivo: copia del texto completo en IndexedDB con debounce corto.
 * Protege frente a cierres bruscos y es el único autosave en modo degradado.
 *
 * `schedule()` no serializa: solo marca que hay cambios. El texto se pide en el `flush` (una vez
 * cada DEBOUNCE_MS), así escribir no encadena un `joinDocument` por pulsación.
 *
 * La clave es la del archivo físico (ver `resolveFileIdentity`), no el nombre, para no mezclar el
 * borrador de dos archivos que se llamen igual. Además se guarda el hash de la versión del disco de
 * la que parte, y solo se ofrece recuperarlo si coincide con el archivo abierto.
 */
export class LiveDraft {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor(
    private readonly draftKey: string,
    private readonly getText: () => string,
    private readonly baseHash: () => string | undefined = () => undefined,
  ) {}

  /** Marca que hay cambios; el texto se serializa al vaciar. */
  schedule(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const text = this.getText();
    try {
      const db = await getDB();
      await db.put('drafts', { todoId: this.draftKey, ts: Date.now(), text, baseHash: this.baseHash() });
    } catch {
      /* si IndexedDB falla, el autosave sobre el archivo sigue funcionando */
    }
  }

  async clear(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.dirty = false;
    await LiveDraft.remove(this.draftKey);
  }

  static async read(draftKey: string): Promise<DraftRecord | undefined> {
    const db = await getDB();
    return db.get('drafts', draftKey);
  }

  /** Borra un borrador por clave (p. ej. uno antiguo, guardado aún bajo el id por nombre). */
  static async remove(draftKey: string): Promise<void> {
    const db = await getDB();
    await db.delete('drafts', draftKey);
  }
}
