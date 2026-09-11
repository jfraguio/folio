/** Representa un archivo abierto, independientemente del mecanismo de acceso. */
export interface TodoFile {
  name: string;
  /** Solo en FsAccessAdapter. */
  handle?: FileSystemFileHandle;
  /** Solo en FallbackAdapter (archivo leído una vez). */
  file?: File;
}

export interface FileAdapterCapabilities {
  directWrite: boolean;
  persistentHandle: boolean;
}

export interface FileAdapter {
  readonly capabilities: FileAdapterCapabilities;
  open(): Promise<TodoFile | null>;
  create(defaultContent: string): Promise<TodoFile | null>;
  read(f: TodoFile): Promise<{ text: string; mtime: number }>;
  write(f: TodoFile, text: string): Promise<{ mtime: number }>;
  saveAs(text: string, suggestedName: string): Promise<TodoFile | null>;
}

/** Normaliza el contenido al abrir: BOM y saltos de línea. */
export function normalizeText(text: string): string {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return t.replace(/\r\n?/g, '\n');
}

/** Un archivo nuevo arranca vacío: las 10 tabs vacías no escriben ningún marcador. */
export const DEFAULT_TODO_CONTENT = '';
export const DEFAULT_TODO_NAME = 'to-do.md';

export class AbortedByUser extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortedByUser';
  }
}

export function isAbort(e: unknown): boolean {
  return e instanceof AbortedByUser || (e instanceof DOMException && e.name === 'AbortError');
}
