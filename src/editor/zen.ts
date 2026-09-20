import { Compartment, type Extension } from '@codemirror/state';
import { typography } from './typography';
import { focusMode } from './focusMode';

/**
 * Lo que el modo zen añade al editor: las sustituciones al teclear y el focus mode de Folio
 * (texto atenuado salvo el párrafo del cursor). Las tabs y la tipografía van por CSS
 * (`html[data-zen]`), que pone la preferencia (prefs.ts).
 */
export const zenCompartment = new Compartment();

export function zen(enabled: boolean): Extension {
  return enabled ? [typography(), focusMode()] : [];
}
