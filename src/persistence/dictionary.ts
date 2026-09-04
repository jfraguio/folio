import { getDB } from './db';

/**
 * Diccionario personal de la novela abierta. Vive en memoria; la sesión lo serializa
 * dentro del `.md` (ver dictionaryBlock.ts) cada vez que cambia.
 */
export class PersonalDictionary {
  private words = new Set<string>();
  private listeners = new Set<(words: string[]) => void>();

  /** Sustituye el contenido (al abrir la novela o recargarla desde el disco). No notifica. */
  load(words: Iterable<string>): void {
    this.words = new Set(words);
  }

  has(word: string): boolean {
    return this.words.has(word);
  }

  list(): string[] {
    return [...this.words].sort((a, b) => a.localeCompare(b, 'es'));
  }

  /** Devuelve true si el diccionario cambió. */
  add(word: string): boolean {
    const w = word.trim();
    if (!w || /\s/.test(w) || this.words.has(w)) return false;
    this.words.add(w);
    this.emit();
    return true;
  }

  remove(word: string): void {
    if (this.words.delete(word)) this.emit();
  }

  onChange(l: (words: string[]) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit(): void {
    const list = this.list();
    this.listeners.forEach((l) => l(list));
  }
}

/**
 * Migración: versiones anteriores guardaban el diccionario en IndexedDB, global por idioma.
 * Devuelve esas palabras y las borra, para que la novela que se abra las adopte.
 */
export async function takeLegacyWords(lang: string): Promise<string[]> {
  try {
    const db = await getDB();
    const rec = await db.get('dictionary', lang);
    if (!rec || rec.words.length === 0) return [];
    await db.delete('dictionary', lang);
    return rec.words;
  } catch {
    return [];
  }
}
