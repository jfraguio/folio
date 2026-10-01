import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';
import { TabStates, type StateHost } from '../src/app/TabStates';

const build = (doc: string) => EditorState.create({ doc, extensions: [history()] });

/** Editor simulado: solo estado y cómo sustituirlo, que es lo que usa `TabStates`. */
const makeHost = (): StateHost => {
  let state = build('');
  return {
    get state() {
      return state;
    },
    setState(next) {
      state = next;
    },
  };
};

/** Escribe al principio del documento como si fuera el usuario. */
const type = (host: StateHost, insert: string) => {
  host.setState(host.state.update({ changes: { from: 0, insert }, userEvent: 'input.type' }).state);
};

const undoOnce = (host: StateHost) => undo({ state: host.state, dispatch: (tr) => host.setState(tr.state) });

describe('TabStates', () => {
  it('cambiar de tab no contamina el deshacer: ⌘Z no devuelve el texto de otra tab', () => {
    const host = makeHost();
    const states = new TabStates(host, build);
    const tabA = {};
    const tabB = {};

    states.load(tabA, -1, 'tab one');
    type(host, 'X');
    expect(host.state.doc.toString()).toBe('Xtab one');

    // Cambia a la tab B (sin transacción) y deshaz: su historial está vacío.
    states.save(tabA, -1);
    states.load(tabB, -1, 'tab two');
    undoOnce(host);
    expect(host.state.doc.toString()).toBe('tab two');

    // Vuelve a la A: conserva lo escrito y su propio deshacer.
    states.save(tabB, -1);
    states.load(tabA, -1, 'tab one');
    expect(host.state.doc.toString()).toBe('Xtab one');
    undoOnce(host);
    expect(host.state.doc.toString()).toBe('tab one');
  });

  it('cada subtab guarda su estado y quitar una desplaza las demás sin mezclarlas', () => {
    const host = makeHost();
    const states = new TabStates(host, build);
    const tab = {};

    states.load(tab, -1, 'principal');
    states.save(tab, -1);
    states.load(tab, 0, 'cero');
    states.save(tab, 0);
    states.load(tab, 1, 'uno');
    states.save(tab, 1);

    states.dropSub(tab, 0);
    states.load(tab, 0, 'x');
    expect(host.state.doc.toString()).toBe('uno');
  });

  it('load devuelve true solo la primera vez (estado nuevo)', () => {
    const host = makeHost();
    const states = new TabStates(host, build);
    const tab = {};
    expect(states.load(tab, -1, 'a')).toBe(true);
    states.save(tab, -1);
    expect(states.load(tab, -1, 'a')).toBe(false);
  });
});
