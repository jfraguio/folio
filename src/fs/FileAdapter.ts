/** Representa un archivo abierto, independientemente del mecanismo de acceso. */
export interface FolioFile {
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
  open(): Promise<FolioFile | null>;
  create(defaultContent: string): Promise<FolioFile | null>;
  read(f: FolioFile): Promise<{ text: string; mtime: number }>;
  write(f: FolioFile, text: string): Promise<{ mtime: number }>;
  saveAs(text: string, suggestedName: string): Promise<FolioFile | null>;
  /**
   * Fecha de modificación del archivo sin leer su contenido, si el adaptador puede comprobarla
   * (File System Access). Ausente en modo degradado: allí no hay sondeo de cambios externos.
   */
  mtime?(f: FolioFile): Promise<number>;
}

/** Normaliza el contenido al abrir: BOM y saltos de línea. */
export function normalizeText(text: string): string {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return t.replace(/\r\n?/g, '\n');
}

/** Un archivo nuevo arranca vacío: las 10 tabs vacías no escriben ningún marcador. */
export const DEFAULT_FOLIO_CONTENT = '';

/**
 * Formato del archivo: texto plano `.txt`. La aplicación no interpreta Markdown (los `#` y `--`
 * son convenciones propias), y un `.txt` no lo reformatea ningún visor ni editor de Markdown.
 * Los archivos `.md` de versiones anteriores se siguen abriendo (mismo contenido), pero lo que
 * se crea o descarga es siempre `.txt`.
 */
export const FOLIO_EXTENSION = '.txt';
export const FOLIO_MIME = 'text/plain';
export const DEFAULT_FOLIO_NAME = `folio${FOLIO_EXTENSION}`;
/** Extensiones que se aceptan al abrir: la actual y las de archivos anteriores. */
export const FOLIO_OPEN_EXTENSIONS = ['.txt', '.md', '.markdown'];
/** Quita la extensión de un nombre de archivo de folio (`.txt` o las antiguas) para mostrarlo. */
export const stripFolioExtension = (name: string): string => name.replace(/\.(txt|md|markdown)$/i, '');
