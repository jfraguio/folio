/** Representa una novela abierta, independientemente del mecanismo de acceso. */
export interface NovelFile {
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
  open(): Promise<NovelFile | null>;
  create(defaultContent: string): Promise<NovelFile | null>;
  read(f: NovelFile): Promise<{ text: string; mtime: number }>;
  write(f: NovelFile, text: string): Promise<{ mtime: number }>;
  saveAs(text: string, suggestedName: string): Promise<NovelFile | null>;
}

/** Normaliza el contenido al abrir: BOM y saltos de línea. */
export function normalizeText(text: string): string {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return t.replace(/\r\n?/g, '\n');
}

export const DEFAULT_NOVEL_CONTENT = '# Capítulo 1\n\n';
export const DEFAULT_NOVEL_NAME = 'novela.md';

export class AbortedByUser extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortedByUser';
  }
}

export function isAbort(e: unknown): boolean {
  return e instanceof AbortedByUser || (e instanceof DOMException && e.name === 'AbortError');
}
