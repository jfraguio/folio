import { beforeEach, describe, expect, it } from 'vitest';
import { backupFileName, listBackups, localDay, saveOpeningBackup, BACKUP_KEEP } from '../src/persistence/backups';
import { resetDBForTests } from '../src/persistence/db';

/** Borra la BD entre tests: cierra la conexión viva y la elimina. */
async function clearDB(): Promise<void> {
  await resetDBForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('to-do');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('deleteDatabase bloqueado'));
  });
  await resetDBForTests();
}

describe('backups', () => {
  beforeEach(clearDB);

  const DAY = new Date('2026-09-11T10:00:00').getTime();

  it('guarda una copia por día como mucho', async () => {
    expect(await saveOpeningBackup('id1', 'texto de hoy', DAY)).toBe(true);
    expect(await saveOpeningBackup('id1', 'otro texto más tarde ese día', DAY + 3600_000)).toBe(false);
    const all = await listBackups('id1');
    expect(all).toHaveLength(1);
    expect(all[0]!.text).toBe('texto de hoy');
  });

  it('no guarda duplicados aunque cambie el día', async () => {
    expect(await saveOpeningBackup('id1', 'mismo texto', DAY)).toBe(true);
    expect(await saveOpeningBackup('id1', 'mismo texto', DAY + 86_400_000)).toBe(false);
    expect(await listBackups('id1')).toHaveLength(1);
  });

  it('conserva solo las BACKUP_KEEP más recientes', async () => {
    for (let i = 0; i < BACKUP_KEEP + 3; i++) {
      await saveOpeningBackup('id1', `texto ${i}`, DAY + i * 86_400_000);
    }
    const all = await listBackups('id1');
    expect(all).toHaveLength(BACKUP_KEEP);
    expect(all[0]!.text).toBe(`texto ${BACKUP_KEEP + 2}`);
    expect(all.at(-1)!.text).toBe('texto 3');
  });

  it('las copias de archivos distintos no se mezclan', async () => {
    await saveOpeningBackup('id1', 'del uno', DAY);
    await saveOpeningBackup('id2', 'del dos', DAY);
    expect(await listBackups('id1')).toHaveLength(1);
    expect(await listBackups('id2')).toHaveLength(1);
  });

  it('localDay usa el día local en formato YYYY-MM-DD', () => {
    expect(localDay(DAY)).toBe('2026-09-11');
  });

  it('backupFileName sugiere <nombre> — <día>.md', () => {
    expect(backupFileName('to-do.md', { day: '2026-09-11' })).toBe('to-do — 2026-09-11.md');
    expect(backupFileName('notas', { day: '2026-09-11' })).toBe('notas — 2026-09-11.md');
  });
});
