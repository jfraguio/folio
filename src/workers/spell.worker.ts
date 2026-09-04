/// <reference lib="webworker" />
import nspell from 'nspell';

export type SpellRequest =
  | { type: 'load'; id: number; lang: string; affUrl: string; dicUrl: string }
  | { type: 'check'; id: number; words: string[] }
  | { type: 'add'; id: number; words: string[] };

export type SpellResponse =
  | { type: 'loaded'; id: number; lang: string }
  | { type: 'checked'; id: number; results: boolean[] }
  | { type: 'added'; id: number }
  | { type: 'error'; id: number; message: string };

let checker: ReturnType<typeof nspell> | null = null;

const post = (msg: SpellResponse) => (self as unknown as Worker).postMessage(msg);

self.addEventListener('message', async (ev: MessageEvent<SpellRequest>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'load': {
        const [aff, dic] = await Promise.all([
          fetch(msg.affUrl).then((r) => r.text()),
          fetch(msg.dicUrl).then((r) => r.text()),
        ]);
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
      case 'add': {
        if (checker) for (const w of msg.words) checker.add(w);
        post({ type: 'added', id: msg.id });
        break;
      }
    }
  } catch (e) {
    post({ type: 'error', id: msg.id, message: e instanceof Error ? e.message : String(e) });
  }
});
