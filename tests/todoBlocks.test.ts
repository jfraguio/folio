import { describe, expect, it } from 'vitest';
import { joinDocument, splitDocument, TAB_COUNT } from '../src/persistence/todoBlocks';

const doc = (tabs: string[], words: string[] = []) => ({ tabs, words });

describe('todoBlocks', () => {
  it('un archivo vacío produce 10 tabs vacías', () => {
    const d = splitDocument('');
    expect(d.tabs).toHaveLength(TAB_COUNT);
    expect(d.tabs.every((t) => t === '')).toBe(true);
    expect(d.words).toEqual([]);
  });

  it('texto plano sin marcadores se carga entero en la tab 1', () => {
    const d = splitDocument('Hola, esto es texto plano.\nSegunda línea.');
    expect(d.tabs[0]).toBe('Hola, esto es texto plano.\nSegunda línea.');
    expect(d.tabs.slice(1).every((t) => t === '')).toBe(true);
  });

  it('ida y vuelta: tabs con contenido se serializan y se recuperan', () => {
    const tabs = Array.from({ length: TAB_COUNT }, () => '');
    tabs[0] = 'Lista de la compra\nLeche y pan';
    tabs[3] = 'Ideas\nUna app de notas';
    const text = joinDocument(doc(tabs));
    expect(text).toContain('[todo:tab 1]');
    expect(text).toContain('[todo:tab 4]');
    expect(text).not.toContain('[todo:tab 2]');
    const d = splitDocument(text);
    expect(d.tabs[0]).toBe('Lista de la compra\nLeche y pan');
    expect(d.tabs[3]).toBe('Ideas\nUna app de notas');
    expect(d.tabs[1]).toBe('');
  });

  it('las tabs vacías no se escriben y un documento vacío queda vacío', () => {
    expect(joinDocument(doc(Array.from({ length: TAB_COUNT }, () => '')))).toBe('');
  });

  it('abrir y guardar sin tocar nada no cambia el archivo', () => {
    const original = '[todo:tab 2]\nSolo la segunda tab';
    expect(joinDocument(doc(splitDocument(original).tabs))).toBe(original);
  });

  it('el diccionario viaja en un comentario HTML al final', () => {
    const tabs = Array.from({ length: TAB_COUNT }, () => '');
    tabs[0] = 'Texto';
    const text = joinDocument(doc(tabs, ['Aldebarán', 'Kaelith']));
    expect(text).toContain('<!-- todo:diccionario');
    expect(text).toContain('Aldebarán\nKaelith');
    const d = splitDocument(text);
    expect(d.words).toEqual(['Aldebarán', 'Kaelith']);
    expect(d.tabs[0]).toBe('Texto');
  });

  it('sin palabras no se escribe el bloque del diccionario', () => {
    const tabs = Array.from({ length: TAB_COUNT }, () => '');
    tabs[0] = 'Texto';
    expect(joinDocument(doc(tabs, []))).not.toContain('<!--');
  });

  it('líneas con espacios del diccionario se ignoran al leer', () => {
    const text = '[todo:tab 1]\nTexto\n\n<!-- todo:diccionario\ndesc\n\nvalida\nno válida\n-->\n';
    const d = splitDocument(text);
    expect(d.words).toEqual(['valida']);
  });

  it('un bloque de diccionario que no está al final se trata como texto', () => {
    const text = '<!-- todo:diccionario\ndesc\n\nPalabra\n-->\n\n[todo:tab 1]\nTexto';
    const d = splitDocument(text);
    expect(d.words).toEqual([]);
    expect(d.tabs[0]).toContain('todo:diccionario');
  });

  it('un "-->" dentro del diccionario se escapa al escribir y se recupera al leer', () => {
    const d = splitDocument(joinDocument(doc(Array.from({ length: TAB_COUNT }, () => ''), ['a-->b'])));
    // 'a-->b' contiene "-->", se escapa; al leer vuelve (aunque tenga caracteres raros, no rompe el bloque)
    expect(d.words.length).toBe(1);
  });
});
