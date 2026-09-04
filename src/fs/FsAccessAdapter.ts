import type { FileAdapter, NovelFile } from './FileAdapter';
import { normalizeText } from './FileAdapter';

const MD_TYPES: FilePickerAcceptType[] = [
  { description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } },
];

export class FsAccessAdapter implements FileAdapter {
  readonly capabilities = { directWrite: true, persistentHandle: true };

  async open(): Promise<NovelFile | null> {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: MD_TYPES,
        multiple: false,
        excludeAcceptAllOption: false,
      });
      return handle ? { name: handle.name, handle } : null;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
  }

  async create(defaultContent: string): Promise<NovelFile | null> {
    const f = await this.saveAs(defaultContent, 'novela.md');
    return f;
  }

  async read(f: NovelFile): Promise<{ text: string; mtime: number }> {
    const file = await f.handle!.getFile();
    return { text: normalizeText(await file.text()), mtime: file.lastModified };
  }

  async write(f: NovelFile, text: string): Promise<{ mtime: number }> {
    const handle = f.handle!;
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    const after = await handle.getFile();
    return { mtime: after.lastModified };
  }

  async saveAs(text: string, suggestedName: string): Promise<NovelFile | null> {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName, types: MD_TYPES });
      const f: NovelFile = { name: handle.name, handle };
      await this.write(f, text);
      return f;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
  }

  /** Obtiene la fecha de modificación actual sin leer el contenido. */
  async mtime(f: NovelFile): Promise<number> {
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
