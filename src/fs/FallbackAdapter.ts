import type { FileAdapter, NovelFile } from './FileAdapter';
import { normalizeText } from './FileAdapter';

/**
 * Adaptador para navegadores sin File System Access API.
 * Abre con <input type="file">, guarda por descarga. El autosave real lo hace el borrador vivo.
 */
export class FallbackAdapter implements FileAdapter {
  readonly capabilities = { directWrite: false, persistentHandle: false };

  open(): Promise<NovelFile | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,text/markdown';
      input.style.display = 'none';
      document.body.appendChild(input);
      const done = (f: NovelFile | null) => {
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

  async create(defaultContent: string): Promise<NovelFile | null> {
    const file = new File([defaultContent], 'novela.md', {
      type: 'text/markdown',
      lastModified: Date.now(),
    });
    return { name: file.name, file };
  }

  async read(f: NovelFile): Promise<{ text: string; mtime: number }> {
    const file = f.file!;
    return { text: normalizeText(await file.text()), mtime: file.lastModified };
  }

  async write(): Promise<{ mtime: number }> {
    throw new DOMException('Direct write not supported', 'NotSupportedError');
  }

  async saveAs(text: string, suggestedName: string): Promise<NovelFile | null> {
    download(text, suggestedName, 'text/markdown');
    const file = new File([text], suggestedName, { type: 'text/markdown', lastModified: Date.now() });
    return { name: suggestedName, file };
  }
}

export function download(text: string, name: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Guarda un texto en un archivo nuevo elegido por el usuario (`showSaveFilePicker`) o, si el
 * navegador no lo permite, lo descarga. Devuelve el nombre final, o `null` si el usuario canceló.
 * Nunca toca el archivo de la novela abierta.
 */
export async function saveToNewFile(
  text: string,
  suggestedName: string,
  type: { description: string; mime: `${string}/${string}`; extension: `.${string}` },
): Promise<string | null> {
  if (!('showSaveFilePicker' in window)) {
    download(text, suggestedName, type.mime);
    return suggestedName;
  }
  try {
    const h = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: type.description, accept: { [type.mime]: [type.extension] } }],
    });
    const w = await h.createWritable();
    await w.write(text);
    await w.close();
    return h.name;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}
