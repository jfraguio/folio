import type { SpellRequest, SpellResponse } from '../workers/spell.worker';
import { dictionaryUrls, SPELL_LANG } from './dictionaries';

/** Puente con el worker de Hunspell. Cachea resultados por palabra. */
export class SpellService {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: SpellResponse) => void; reject: (e: Error) => void }>();
  private cache = new Map<string, boolean>();
  private loaded: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  get ready(): boolean {
    return this.loaded !== null;
  }

  async load(): Promise<void> {
    if (this.loaded) return this.loaded;
    this.cache.clear();
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/spell.worker.ts', import.meta.url), { type: 'module' });
      this.worker.addEventListener('message', (ev: MessageEvent<SpellResponse>) => {
        const p = this.pending.get(ev.data.id);
        if (!p) return;
        this.pending.delete(ev.data.id);
        if (ev.data.type === 'error') p.reject(new Error(ev.data.message));
        else p.resolve(ev.data);
      });
    }
    const { aff, dic } = dictionaryUrls();
    this.loaded = this.send({ type: 'load', id: 0, lang: SPELL_LANG, affUrl: aff, dicUrl: dic }).then(() => {
      this.listeners.forEach((l) => l());
    });
    return this.loaded;
  }

  /** Resultado cacheado (true = correcta) o undefined si aún no se ha consultado. */
  cached(word: string): boolean | undefined {
    return this.cache.get(word);
  }

  async check(words: string[]): Promise<Map<string, boolean>> {
    const out = new Map<string, boolean>();
    const unknown: string[] = [];
    for (const w of words) {
      const c = this.cache.get(w);
      if (c !== undefined) out.set(w, c);
      else unknown.push(w);
    }
    if (unknown.length && this.loaded) {
      await this.loaded;
      const res = await this.send({ type: 'check', id: 0, words: unknown });
      if (res.type === 'checked') {
        unknown.forEach((w, i) => {
          const ok = res.results[i] ?? true;
          this.cache.set(w, ok);
          out.set(w, ok);
        });
      }
    }
    return out;
  }

  async addWords(words: string[]): Promise<void> {
    for (const w of words) this.cache.set(w, true);
    if (this.loaded) {
      await this.loaded;
      await this.send({ type: 'add', id: 0, words });
    }
  }

  markCorrect(word: string): void {
    this.cache.set(word, true);
  }

  onReady(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.loaded = null;
    this.cache.clear();
  }

  private send(msg: SpellRequest): Promise<SpellResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ ...msg, id });
    });
  }
}
