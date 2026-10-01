import type { FileAdapter, FolioFile } from './FileAdapter';
import { DEFAULT_FOLIO_NAME, normalizeText, FOLIO_MIME, FOLIO_OPEN_EXTENSIONS } from './FileAdapter';
import { download } from './download';

/**
 * Adaptador para navegadores sin File System Access API.
 * Abre con <input type="file">, guarda por descarga. El autosave real lo hace el borrador vivo.
 */
export class FallbackAdapter implements FileAdapter {
  readonly capabilities = { directWrite: false, persistentHandle: false };

  open(): Promise<FolioFile | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = [...FOLIO_OPEN_EXTENSIONS, FOLIO_MIME, 'text/markdown'].join(',');
      input.style.display = 'none';
      document.body.appendChild(input);
      const done = (f: FolioFile | null) => {
        input.remove();
        resolve(f);
      };
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        done(file ? { name: file.name, file } : null);
      });
      input.addEventListener('cancel', () => done(null));
      input.click();
    });
  }

  async create(defaultContent: string): Promise<FolioFile | null> {
    const file = new File([defaultContent], DEFAULT_FOLIO_NAME, {
      type: FOLIO_MIME,
      lastModified: Date.now(),
    });
    return { name: file.name, file };
  }

  async read(f: FolioFile): Promise<{ text: string; mtime: number }> {
    const file = f.file!;
    return { text: normalizeText(await file.text()), mtime: file.lastModified };
  }

  async write(): Promise<{ mtime: number }> {
    throw new DOMException('Direct write not supported', 'NotSupportedError');
  }

  async saveAs(text: string, suggestedName: string): Promise<FolioFile | null> {
    download(text, suggestedName, FOLIO_MIME);
    const file = new File([text], suggestedName, { type: FOLIO_MIME, lastModified: Date.now() });
    return { name: suggestedName, file };
  }
}
