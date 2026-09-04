import { getDB } from './db';

/** Diccionario personal, en memoria y persistido en IndexedDB. */
export class PersonalDictionary {
  private words = new Set<string>();
  private listeners = new Set<(words: string[]) => void>();

  constructor(private readonly lang: string) {}

  async load(): Promise<void> {
    const db = await getDB();
    const rec = await db.get('dictionary', this.lang);
    this.words = new Set(rec?.words ?? []);
    this.emit();
  }

  has(word: string): boolean {
    return this.words.has(word);
  }

  list(): string[] {
    return [...this.words].sort((a, b) => a.localeCompare(b, 'es'));
  }

  async add(word: string): Promise<void> {
    const w = word.trim();
    if (!w) return;
    this.words.add(w);
    await this.persist();
  }

  async remove(word: string): Promise<void> {
    this.words.delete(word);
    await this.persist();
  }

  onChange(l: (words: string[]) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private async persist(): Promise<void> {
    const db = await getDB();
    await db.put('dictionary', { lang: this.lang, words: [...this.words] });
    this.emit();
  }

  private emit(): void {
    const list = [...this.words];
    this.listeners.forEach((l) => l(list));
  }
}
