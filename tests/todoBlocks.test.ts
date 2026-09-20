import { describe, expect, it } from 'vitest';
import { joinDocument, splitDocument, TAB_COUNT } from '../src/persistence/todoBlocks';

const doc = (tabs: string[], words: string[] = []) => ({ tabs, words });

describe('todoBlocks', () => {
  it('un archivo vacío produce una sola tab vacía', () => {
    const d = splitDocument('');
    expect(d.tabs).toEqual(['']);
    expect(d.words).toEqual([]);
  });

  it('texto plano sin marcadores se carga entero en la tab 1', () => {
    const d = splitDocument('Hola, esto es texto plano.\nSegunda línea.');
    expect(d.tabs).toEqual(['Hola, esto es texto plano.\nSegunda línea.']);
  });

  it('ida y vuelta: tabs con contenido se serializan y se recuperan', () => {
    const tabs = ['Lista de la compra\nLeche y pan', '', '', 'Ideas\nUna app de notas'];
    const text = joinDocument(doc(tabs));
    expect(text).toContain('[todo:tab 1]');
    expect(text).toContain('[todo:tab 4]');
    const d = splitDocument(text);
    expect(d.tabs).toEqual(tabs);
  });

  it('las tabs vacías se escriben solo con su marcador para que sigan existiendo', () => {
    const text = joinDocument(doc(['Uno', '', 'Tres', '']));
    expect(text).toBe('[todo:tab 1]\nUno\n[todo:tab 2]\n[todo:tab 3]\nTres\n[todo:tab 4]');
    expect(splitDocument(text).tabs).toEqual(['Uno', '', 'Tres', '']);
  });

  it('varias tabs vacías se conservan aunque no haya texto', () => {
    const text = joinDocument(doc(['', '']));
    expect(text).toBe('[todo:tab 1]\n[todo:tab 2]');
    expect(splitDocument(text).tabs).toEqual(['', '']);
  });

  it('un documento con una única tab vacía queda vacío', () => {
    expect(joinDocument(doc(['']))).toBe('');
    expect(joinDocument(doc([]))).toBe('');
    expect(joinDocument(doc(['   \n']))).toBe('');
  });

  it('abrir y guardar sin tocar nada no cambia el archivo', () => {
    const original = '[todo:tab 1]\nPrimera\n[todo:tab 2]\n[todo:tab 3]\nTercera';
    expect(joinDocument(doc(splitDocument(original).tabs))).toBe(original);
  });

  it('archivos antiguos: los huecos entre marcadores son tabs vacías y nada cambia de sitio', () => {
    const d = splitDocument('[todo:tab 2]\nSolo la segunda tab\n[todo:tab 4]\nCuarta');
    expect(d.tabs).toEqual(['', 'Solo la segunda tab', '', 'Cuarta']);
  });

  it('el contenido conserva sus saltos internos y sus líneas vacías iniciales', () => {
    const tabs = ['\nEmpieza con línea vacía\n\nY tiene un hueco', 'b'];
    expect(splitDocument(joinDocument(doc(tabs))).tabs).toEqual(tabs);
  });

  it('nunca hay más de TAB_COUNT tabs', () => {
    const many = Array.from({ length: TAB_COUNT + 3 }, (_, i) => `t${i + 1}`);
    const d = splitDocument(joinDocument(doc(many)));
    expect(d.tabs).toHaveLength(TAB_COUNT);
    expect(d.tabs[TAB_COUNT - 1]).toBe(`t${TAB_COUNT}`);
    // Un marcador por encima del máximo (editado a mano) no crea tabs de más.
    expect(splitDocument('[todo:tab 1]\na\n[todo:tab 99]\nz').tabs).toHaveLength(TAB_COUNT);
  });

  it('el diccionario viaja en un comentario HTML al final', () => {
    const text = joinDocument(doc(['Texto'], ['Aldebarán', 'Kaelith']));
    expect(text).toContain('<!-- todo:diccionario');
    expect(text).toContain('Aldebarán\nKaelith');
    const d = splitDocument(text);
    expect(d.words).toEqual(['Aldebarán', 'Kaelith']);
    expect(d.tabs).toEqual(['Texto']);
  });

  it('el diccionario tras una última tab vacía no la contamina', () => {
    const text = joinDocument(doc(['Texto', ''], ['Palabra']));
    const d = splitDocument(text);
    expect(d.tabs).toEqual(['Texto', '']);
    expect(d.words).toEqual(['Palabra']);
  });

  it('sin palabras no se escribe el bloque del diccionario', () => {
    expect(joinDocument(doc(['Texto'], []))).not.toContain('<!--');
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
    const d = splitDocument(joinDocument(doc([''], ['a-->b'])));
    expect(d.words).toEqual(['a-->b']);
  });
});
