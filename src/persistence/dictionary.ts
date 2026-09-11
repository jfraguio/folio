/**
 * Diccionario personal del archivo abierto. Vive en memoria; la sesión lo serializa
 * dentro del `.md` (ver todoBlocks.ts) cada vez que cambia.
 */
export class PersonalDictionary {
  private words = new Set<string>();
  private listeners = new Set<(words: string[]) => void>();

  /** Sustituye el contenido (al abrir el archivo o recargarlo desde el disco). No notifica. */
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
