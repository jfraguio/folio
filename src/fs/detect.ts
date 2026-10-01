import type { FileAdapter } from './FileAdapter';
import { FsAccessAdapter } from './FsAccessAdapter';
import { FallbackAdapter } from './FallbackAdapter';

export function hasFsAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

export function createAdapter(): FileAdapter {
  return hasFsAccess() ? new FsAccessAdapter() : new FallbackAdapter();
}
