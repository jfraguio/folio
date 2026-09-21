import { describe, expect, it } from 'vitest';
import { allTexts, joinDocument, splitDocument, TAB_COUNT, type Tab } from '../src/persistence/todoBlocks';

/** Tab con texto y, opcionalmente, subtabs. */
const T = (text: string, subs: string[] = []): Tab => ({ text, subs });
const doc = (tabs: Tab[], words: string[] = []) => ({ tabs, words });
/** Atajo para documentos sin subtabs. */
const plain = (...texts: string[]) => texts.map((t) => T(t));

describe('todoBlocks', () => {
  it('un archivo vacío produce una sola tab vacía', () => {
    const d = splitDocument('');
    expect(d.tabs).toEqual([T('')]);
    expect(d.words).toEqual([]);
  });

  it('texto plano sin marcadores se carga entero en la tab 1', () => {
    const d = splitDocument('Hola, esto es texto plano.\nSegunda línea.');
    expect(d.tabs).toEqual([T('Hola, esto es texto plano.\nSegunda línea.')]);
  });

  it('ida y vuelta: tabs con contenido se serializan y se recuperan', () => {
    const tabs = plain('Lista de la compra\nLeche y pan', '', '', 'Ideas\nUna app de notas');
    const text = joinDocument(doc(tabs));
    expect(text).toContain('[todo:tab 1]');
    expect(text).toContain('[todo:tab 4]');
    const d = splitDocument(text);
    expect(d.tabs).toEqual(tabs);
  });

  it('las tabs vacías se escriben solo con su marcador para que sigan existiendo', () => {
    const text = joinDocument(doc(plain('Uno', '', 'Tres', '')));
    expect(text).toBe('[todo:tab 1]\nUno\n[todo:tab 2]\n[todo:tab 3]\nTres\n[todo:tab 4]');
    expect(splitDocument(text).tabs).toEqual(plain('Uno', '', 'Tres', ''));
  });

  it('varias tabs vacías se conservan aunque no haya texto', () => {
    const text = joinDocument(doc(plain('', '')));
    expect(text).toBe('[todo:tab 1]\n[todo:tab 2]');
    expect(splitDocument(text).tabs).toEqual(plain('', ''));
  });

  it('un documento con una única tab vacía queda vacío', () => {
    expect(joinDocument(doc(plain('')))).toBe('');
    expect(joinDocument(doc([]))).toBe('');
    expect(joinDocument(doc(plain('   \n')))).toBe('');
  });

  it('abrir y guardar sin tocar nada no cambia el archivo', () => {
    const original = '[todo:tab 1]\nPrimera\n[todo:tab 2]\n[todo:tab 3]\nTercera';
    expect(joinDocument(doc(splitDocument(original).tabs))).toBe(original);
  });

  it('archivos antiguos: los huecos entre marcadores son tabs vacías y nada cambia de sitio', () => {
    const d = splitDocument('[todo:tab 2]\nSolo la segunda tab\n[todo:tab 4]\nCuarta');
    expect(d.tabs).toEqual(plain('', 'Solo la segunda tab', '', 'Cuarta'));
  });

  it('el contenido conserva sus saltos internos y sus líneas vacías iniciales', () => {
    const tabs = plain('\nEmpieza con línea vacía\n\nY tiene un hueco', 'b');
    expect(splitDocument(joinDocument(doc(tabs))).tabs).toEqual(tabs);
  });

  it('nunca hay más de TAB_COUNT tabs', () => {
    const many = Array.from({ length: TAB_COUNT + 3 }, (_, i) => T(`t${i + 1}`));
    const d = splitDocument(joinDocument(doc(many)));
    expect(d.tabs).toHaveLength(TAB_COUNT);
    expect(d.tabs[TAB_COUNT - 1]!.text).toBe(`t${TAB_COUNT}`);
    // Un marcador por encima del máximo (editado a mano) no crea tabs de más.
    expect(splitDocument('[todo:tab 1]\na\n[todo:tab 99]\nz').tabs).toHaveLength(TAB_COUNT);
  });

  describe('subtabs', () => {
    it('se escriben tras el contenido de su tab con marcador N.M y se recuperan', () => {
      const tabs = [T('Novela', ['Capítulo uno\nTexto', '', 'Capítulo tres']), T('Notas')];
      const text = joinDocument(doc(tabs));
      expect(text).toBe(
        '[todo:tab 1]\nNovela\n[todo:tab 1.1]\nCapítulo uno\nTexto\n[todo:tab 1.2]\n[todo:tab 1.3]\nCapítulo tres\n[todo:tab 2]\nNotas',
      );
      expect(splitDocument(text).tabs).toEqual(tabs);
    });

    it('una tab vacía con subtabs se conserva, y una única tab vacía con una subtab vacía no es el documento vacío', () => {
      expect(joinDocument(doc([T('', [''])]))).toBe('[todo:tab 1]\n[todo:tab 1.1]');
      expect(splitDocument('[todo:tab 1]\n[todo:tab 1.1]').tabs).toEqual([T('', [''])]);
    });

    it('los huecos entre marcadores de subtab son subtabs vacías', () => {
      const d = splitDocument('[todo:tab 1]\n[todo:tab 1.3]\nTercera sub\n[todo:tab 2]\nDos');
      expect(d.tabs).toEqual([T('', ['', '', 'Tercera sub']), T('Dos')]);
    });

    it('un marcador de subtab de una tab sin marcador propio crea la tab', () => {
      const d = splitDocument('[todo:tab 1]\nUno\n[todo:tab 3.1]\nSub de la tres');
      expect(d.tabs).toEqual([T('Uno'), T(''), T('', ['Sub de la tres'])]);
    });

    it('nunca hay más de TAB_COUNT subtabs por tab', () => {
      const many = Array.from({ length: TAB_COUNT + 2 }, (_, i) => `s${i + 1}`);
      const d = splitDocument(joinDocument(doc([T('a', many)])));
      expect(d.tabs[0]!.subs).toHaveLength(TAB_COUNT);
      expect(splitDocument('[todo:tab 1]\n[todo:tab 1.99]\nz').tabs[0]!.subs).toHaveLength(TAB_COUNT);
    });

    it('abrir y guardar un archivo con subtabs no lo cambia', () => {
      const original = '[todo:tab 1]\nUno\n[todo:tab 1.1]\nSub\n[todo:tab 2]\n[todo:tab 2.1]\n[todo:tab 2.2]\nOtra';
      expect(joinDocument(doc(splitDocument(original).tabs))).toBe(original);
    });

    it('allTexts devuelve tabs y subtabs en el orden del archivo', () => {
      expect(allTexts([T('a', ['a1', 'a2']), T('b')])).toEqual(['a', 'a1', 'a2', 'b']);
    });
  });

  it('el diccionario viaja en un comentario HTML al final', () => {
    const text = joinDocument(doc(plain('Texto'), ['Aldebarán', 'Kaelith']));
    expect(text).toContain('<!-- todo:diccionario');
    expect(text).toContain('Aldebarán\nKaelith');
    const d = splitDocument(text);
    expect(d.words).toEqual(['Aldebarán', 'Kaelith']);
    expect(d.tabs).toEqual(plain('Texto'));
  });

  it('el diccionario tras una última tab vacía no la contamina', () => {
    const text = joinDocument(doc(plain('Texto', ''), ['Palabra']));
    const d = splitDocument(text);
    expect(d.tabs).toEqual(plain('Texto', ''));
    expect(d.words).toEqual(['Palabra']);
  });

  it('el diccionario tras una última subtab vacía no la contamina', () => {
    const text = joinDocument(doc([T('Texto', [''])], ['Palabra']));
    const d = splitDocument(text);
    expect(d.tabs).toEqual([T('Texto', [''])]);
    expect(d.words).toEqual(['Palabra']);
  });

  it('sin palabras no se escribe el bloque del diccionario', () => {
    expect(joinDocument(doc(plain('Texto'), []))).not.toContain('<!--');
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
    expect(d.tabs[0]!.text).toContain('todo:diccionario');
  });

  it('un "-->" dentro del diccionario se escapa al escribir y se recupera al leer', () => {
    const d = splitDocument(joinDocument(doc(plain(''), ['a-->b'])));
    expect(d.words).toEqual(['a-->b']);
  });
});
