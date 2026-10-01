/// <reference lib="webworker" />
import nspell from 'nspell';

export type SpellRequest =
  | { type: 'load'; id: number; lang: string; affUrl: string; dicUrl: string }
  | { type: 'check'; id: number; words: string[] };

export type SpellResponse =
  | { type: 'loaded'; id: number; lang: string }
  | { type: 'checked'; id: number; results: boolean[] }
  | { type: 'error'; id: number; message: string };

let checker: ReturnType<typeof nspell> | null = null;

const post = (msg: SpellResponse) => (self as unknown as Worker).postMessage(msg);

/** Un 404 o una página de error no es un diccionario: no debe llegar a nspell. */
async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return res.text();
}

self.addEventListener('message', async (ev: MessageEvent<SpellRequest>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'load': {
        const [aff, dic] = await Promise.all([fetchText(msg.affUrl), fetchText(msg.dicUrl)]);
        checker = nspell(aff, dic);
        post({ type: 'loaded', id: msg.id, lang: msg.lang });
        break;
      }
      case 'check': {
        if (!checker) throw new Error('Diccionario no cargado');
        const results = msg.words.map((w) => checker!.correct(w));
        post({ type: 'checked', id: msg.id, results });
        break;
      }
    }
  } catch (e) {
    post({ type: 'error', id: msg.id, message: e instanceof Error ? e.message : String(e) });
  }
});
