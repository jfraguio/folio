export interface FileWatcherOptions {
  /** mtime actual del archivo en disco (sin leer su contenido). */
  mtime: () => Promise<number>;
  /** mtime de la versión que la aplicación tiene cargada (`lastKnownModified`). */
  lastKnown: () => number;
  /**
   * Si devuelve `false`, un cambio detectado no se aplica (p. ej. hay cambios locales sin guardar
   * o una escritura en vuelo). La comprobación se repetirá en el siguiente ciclo.
   */
  canReload?: () => boolean;
  /** Se llama cuando el mtime del disco es posterior al conocido. Debe recargar y actualizar `lastKnown`. */
  onChange: (diskMtime: number) => void | Promise<void>;
  onError?: (error: unknown) => void;
  intervalMs?: number;
}

/**
 * Detección ligera de cambios externos: compara periódicamente el `lastModified` del archivo con
 * el de la versión cargada. No lee el contenido ni calcula hashes; solo cuando el mtime del disco
 * es posterior se delega en `onChange`, que es quien relee el archivo.
 *
 * Una sola comprobación en vuelo: si se solicita otra (p. ej. al recuperar el foco) mientras hay
 * una en curso, se ignora.
 */
export class FileWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private checking = false;
  private disposed = false;
  private readonly intervalMs: number;

  constructor(private readonly opts: FileWatcherOptions) {
    this.intervalMs = opts.intervalMs ?? 10_000;
  }

  /** Arranca el sondeo periódico. Idempotente. */
  start(): void {
    if (this.disposed || this.timer) return;
    this.timer = setInterval(() => void this.check(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Comprueba el mtime del disco y, si es posterior al conocido, invoca `onChange`.
   * Un mtime igual o anterior no recarga: la versión cargada sigue considerándose la vigente.
   * Devuelve `true` si se detectó (y aplicó) un cambio externo.
   */
  async check(): Promise<boolean> {
    if (this.disposed || this.checking) return false;
    this.checking = true;
    try {
      const diskMtime = await this.opts.mtime();
      if (this.disposed) return false;
      if (diskMtime <= this.opts.lastKnown()) return false;
      if (this.opts.canReload && !this.opts.canReload()) return false;
      await this.opts.onChange(diskMtime);
      return true;
    } catch (e) {
      // Con iCloud el archivo puede no estar disponible unos instantes mientras se sincroniza;
      // no es un error del usuario. Se reintenta en el siguiente ciclo.
      this.opts.onError?.(e);
      return false;
    } finally {
      this.checking = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }
}
