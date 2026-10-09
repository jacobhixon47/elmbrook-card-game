import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RUN_VERSION } from '../src/core';
import { clearRun, loadRun, saveRun } from '../src/save';
import { brewing } from './helpers';

/** A stand-in for the browser's localStorage. */
function fakeStorage(fail = false) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (fail) throw new Error('quota');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
}

const g = globalThis as { localStorage?: unknown };

describe('the saved run', () => {
  beforeEach(() => {
    g.localStorage = fakeStorage();
  });
  afterEach(() => {
    delete g.localStorage;
  });

  it('round-trips a run in progress', () => {
    const s = brewing('save');
    saveRun(s);
    expect(loadRun()).toEqual(s);
    clearRun();
    expect(loadRun()).toBeNull();
  });

  it('clears the slot when the run is over', () => {
    saveRun(brewing('save'));
    saveRun({ ...brewing('save'), phase: 'game-over' });
    expect(loadRun()).toBeNull();
    saveRun(brewing('save'));
    saveRun({ ...brewing('save'), phase: 'victory' });
    expect(loadRun()).toBeNull();
  });

  it('drops a save from another version or one it cannot read', () => {
    const storage = g.localStorage as ReturnType<typeof fakeStorage>;
    storage.data.set('elmbrook.run', JSON.stringify({ ...brewing('save'), version: RUN_VERSION - 1 }));
    expect(loadRun()).toBeNull();
    storage.data.set('elmbrook.run', '{not json');
    expect(loadRun()).toBeNull();
  });

  it('carries on without storage, or when it is full', () => {
    delete g.localStorage;
    expect(() => saveRun(brewing('save'))).not.toThrow();
    expect(loadRun()).toBeNull();
    expect(() => clearRun()).not.toThrow();
    g.localStorage = fakeStorage(true);
    expect(() => saveRun(brewing('save'))).not.toThrow();
    expect(loadRun()).toBeNull();
  });
});
