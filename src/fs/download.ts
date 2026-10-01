/** Descarga un texto como archivo (fallback cuando no hay File System Access). */
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
 * Nunca toca el archivo abierto. Lo usan el historial y «Guardar como».
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
    try {
      await w.write(text);
      await w.close();
    } catch (e) {
      try {
        await w.abort();
      } catch {
        /* ya cerrado o abortado */
      }
      throw e;
    }
    return h.name;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}
