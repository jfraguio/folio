import type { FileAdapter, TodoFile } from './FileAdapter';
import { DEFAULT_TODO_NAME, normalizeText, TODO_EXTENSION, TODO_MIME } from './FileAdapter';

/** Al abrir se aceptan también los `.md` de versiones anteriores; al guardar, solo `.txt`. */
const OPEN_TYPES: FilePickerAcceptType[] = [
  { description: 'Texto', accept: { [TODO_MIME]: [TODO_EXTENSION], 'text/markdown': ['.md', '.markdown'] } },
];
const SAVE_TYPES: FilePickerAcceptType[] = [{ description: 'Texto', accept: { [TODO_MIME]: [TODO_EXTENSION] } }];

export class FsAccessAdapter implements FileAdapter {
  readonly capabilities = { directWrite: true, persistentHandle: true };

  async open(): Promise<TodoFile | null> {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: OPEN_TYPES,
        multiple: false,
        excludeAcceptAllOption: false,
      });
      return handle ? { name: handle.name, handle } : null;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
  }

  async create(defaultContent: string): Promise<TodoFile | null> {
    const f = await this.saveAs(defaultContent, DEFAULT_TODO_NAME);
    return f;
  }

  async read(f: TodoFile): Promise<{ text: string; mtime: number }> {
    const file = await f.handle!.getFile();
    return { text: normalizeText(await file.text()), mtime: file.lastModified };
  }

  async write(f: TodoFile, text: string): Promise<{ mtime: number }> {
    const handle = f.handle!;
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    const after = await handle.getFile();
    return { mtime: after.lastModified };
  }

  async saveAs(text: string, suggestedName: string): Promise<TodoFile | null> {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName, types: SAVE_TYPES });
      const f: TodoFile = { name: handle.name, handle };
      await this.write(f, text);
      return f;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
  }

  /** Obtiene la fecha de modificación actual sin leer el contenido. */
  async mtime(f: TodoFile): Promise<number> {
    const file = await f.handle!.getFile();
    return file.lastModified;
  }

  /** Pide permiso de escritura sobre un handle persistido (requiere gesto de usuario). */
  static async ensurePermission(handle: FileSystemFileHandle): Promise<boolean> {
    const opts = { mode: 'readwrite' as const };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    return (await handle.requestPermission(opts)) === 'granted';
  }
}
