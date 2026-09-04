import { getDB, type DraftRecord } from './db';

const DEBOUNCE_MS = 300;

/**
 * Borrador vivo: copia del texto completo en IndexedDB con debounce corto.
 * Protege frente a cierres bruscos y es el único autosave en modo degradado.
 */
export class LiveDraft {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: string | null = null;

  constructor(private readonly novelId: string) {}

  schedule(text: string): void {
    this.pending = text;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending === null) return;
    const text = this.pending;
    this.pending = null;
    try {
      const db = await getDB();
      await db.put('drafts', { novelId: this.novelId, ts: Date.now(), text });
    } catch {
      /* si IndexedDB falla, el autosave sobre el archivo sigue funcionando */
    }
  }

  async clear(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.pending = null;
    const db = await getDB();
    await db.delete('drafts', this.novelId);
  }

  static async read(novelId: string): Promise<DraftRecord | undefined> {
    const db = await getDB();
    return db.get('drafts', novelId);
  }
}
