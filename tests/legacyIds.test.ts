import { describe, expect, it } from 'vitest';
import { LEGACY } from '../src/persistence/legacyIds';
import { joinDocument, splitDocument } from '../src/persistence/folioFormat';

/**
 * Estos valores están congelados: cambiarlos rompería la compatibilidad con archivos, borradores,
 * prefs y bloqueos ya guardados. Si este test falla, NO actualices la expectativa: revierte el cambio.
 */
describe('identificadores persistidos (legacy)', () => {
  it('mantienen el nombre antiguo de la app', () => {
    expect(LEGACY).toEqual({
      tabMarker: 'todo:tab',
      dictTag: 'todo:diccionario',
      dbName: 'to-do',
      prefKeys: { theme: 'todo.theme', spellEnabled: 'todo.spell.enabled', zen: 'todo.zen' },
      channel: 'to-do',
      lockPrefix: 'to-do:',
    });
  });

  it('el formato escrito usa esos mismos marcadores', () => {
    const text = joinDocument({ tabs: [{ text: 'hola', subs: [] }], words: ['Kaelith'] });
    expect(text).toContain(`[${LEGACY.tabMarker} 1]`);
    expect(text).toContain(`<!-- ${LEGACY.dictTag}`);
    expect(splitDocument(text).tabs[0]!.text).toBe('hola');
  });
});
