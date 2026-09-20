// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTouchFlag, isTouch } from '../src/fs/detect';

function mockPointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({ matches: q === '(pointer: coarse)' && coarse, media: q })),
  );
  // happy-dom expone window === globalThis; matchMedia debe verse desde window.
  (window as unknown as { matchMedia: unknown }).matchMedia = globalThis.matchMedia;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.touch;
});

describe('isTouch', () => {
  it('es táctil cuando el puntero principal es grueso (dedo)', () => {
    mockPointer(true);
    expect(isTouch()).toBe(true);
  });

  it('no es táctil con ratón o trackpad', () => {
    mockPointer(false);
    expect(isTouch()).toBe(false);
  });

  it('no depende del user-agent: un iPad que se anuncia como Mac sigue siendo táctil', () => {
    mockPointer(true);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15' });
    expect(isTouch()).toBe(true);
  });
});

describe('applyTouchFlag', () => {
  it('marca <html data-touch> solo en táctil', () => {
    mockPointer(false);
    applyTouchFlag();
    expect('touch' in document.documentElement.dataset).toBe(false);

    mockPointer(true);
    applyTouchFlag();
    expect('touch' in document.documentElement.dataset).toBe(true);
  });
});
