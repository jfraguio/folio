import type { SpellRequest, SpellResponse } from '../workers/spell.worker';
import { dictionaryUrls, SPELL_LANG } from './dictionaries';

export type SpellState = 'idle' | 'loading' | 'ready' | 'failed';

/** Se puede sustituir en tests; en producción es el worker de Hunspell. */
export type WorkerFactory = () => Worker;

function defaultWorker(): Worker {
  return new Worker(new URL('../workers/spell.worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Puente con el worker de Hunspell. Cachea resultados por palabra.
 *
 * La carga puede fallar (red, 404 del diccionario, script del worker que ya no existe tras un
 * despliegue): en ese caso el estado pasa a `failed` y se puede reintentar con `load()`.
 */
export class SpellService {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: SpellResponse) => void; reject: (e: Error) => void }>();
  private cache = new Map<string, boolean>();
  private loadPromise: Promise<void> | null = null;
  private stateValue: SpellState = 'idle';
  private listeners = new Set<() => void>();
  /** Cambia en `dispose` para que una carga en vuelo no reviva el estado tras cerrar. */
  private epoch = 0;

  constructor(private readonly createWorker: WorkerFactory = defaultWorker) {}

  get state(): SpellState {
    return this.stateValue;
  }

  get ready(): boolean {
    return this.stateValue === 'ready';
  }

  async load(): Promise<void> {
    if (this.stateValue === 'ready') return;
    if (this.loadPromise) return this.loadPromise;
    this.cache.clear();
    this.ensureWorker();
    this.setState('loading');
    const { aff, dic } = dictionaryUrls();
    const epoch = this.epoch;
    this.loadPromise = this.send({ type: 'load', id: 0, lang: SPELL_LANG, affUrl: aff, dicUrl: dic })
      .then(() => {
        if (this.epoch !== epoch) return;
        this.setState('ready');
        this.listeners.forEach((l) => l());
      })
      .catch((e) => {
        if (this.epoch === epoch) {
          // Se olvida la promesa rechazada para que un `load()` posterior pueda reintentar.
          this.loadPromise = null;
          this.setState('failed');
        }
        throw e;
      });
    return this.loadPromise;
  }

  async check(words: string[]): Promise<Map<string, boolean>> {
    const out = new Map<string, boolean>();
    const unknown: string[] = [];
    for (const w of words) {
      const c = this.cache.get(w);
      if (c !== undefined) out.set(w, c);
      else unknown.push(w);
    }
    if (unknown.length && this.stateValue === 'ready') {
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

  /** Olvida el resultado cacheado de una palabra (p. ej. al quitarla del diccionario personal). */
  forget(word: string): void {
    this.cache.delete(word);
  }

  onReady(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  dispose(): void {
    const e = new Error('SpellService disposed');
    this.epoch++;
    for (const p of this.pending.values()) p.reject(e);
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.loadPromise = null;
    this.cache.clear();
    this.stateValue = 'idle';
  }

  private ensureWorker(): void {
    if (this.worker) return;
    const worker = this.createWorker();
    worker.addEventListener('message', (ev: MessageEvent<SpellResponse>) => {
      if (this.worker !== worker) return;
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      this.pending.delete(ev.data.id);
      if (ev.data.type === 'error') p.reject(new Error(ev.data.message));
      else p.resolve(ev.data);
    });
    // Si el script no carga (p. ej. tras un despliegue con otra versión en caché), las promesas
    // pendientes deben rechazarse; si no, se quedarían colgadas para siempre.
    worker.addEventListener('error', (ev) => {
      if (this.worker !== worker) return;
      this.failAll(new Error(ev.message || 'El worker de ortografía no se pudo cargar'));
    });
    this.worker = worker;
  }

  private failAll(e: Error): void {
    const pending = [...this.pending.values()];
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.loadPromise = null;
    this.setState('failed');
    for (const p of pending) p.reject(e);
  }

  private send(msg: SpellRequest): Promise<SpellResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  private setState(s: SpellState): void {
    this.stateValue = s;
  }
}
