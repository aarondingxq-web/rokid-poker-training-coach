import assert from 'node:assert/strict';
import test from 'node:test';

import { createHistoryRepository, HISTORY_KEY } from '../src/history.js';

function createStorage(seed) {
  const values = new Map(seed === undefined ? [] : [[HISTORY_KEY, seed]]);
  return {
    getStorageSync(key) {
      return values.get(key);
    },
    setStorageSync(key, value) {
      values.set(key, value);
    },
  };
}

test('starts with an empty history when storage is missing or malformed', () => {
  assert.deepEqual(createHistoryRepository(createStorage()).list(), []);
  assert.deepEqual(createHistoryRepository(createStorage('broken')).list(), []);
});

test('saves only confirmed validated structured records', () => {
  const repository = createHistoryRepository(createStorage());
  assert.throws(() => repository.save({ confirmed: false, validated: true }), /确认/);
  assert.throws(() => repository.save({ confirmed: true, validated: false }), /合法/);
  assert.throws(
    () => repository.save({ confirmed: true, validated: true, rawImage: 'secret' }),
    /原始媒体/,
  );

  const saved = repository.save({
    id: 'hand-1',
    confirmed: true,
    validated: true,
    createdAt: '2026-09-10T12:00:00.000Z',
    state: { heroCards: ['As', 'Ad'], boardCards: [] },
  });
  assert.equal(saved.length, 1);
  assert.equal(repository.list()[0].id, 'hand-1');
});

test('keeps at most fifty newest records', () => {
  const repository = createHistoryRepository(createStorage());
  for (let index = 0; index < 55; index += 1) {
    repository.save({
      id: `hand-${index}`,
      confirmed: true,
      validated: true,
      createdAt: new Date(index * 1000).toISOString(),
      state: { heroCards: ['As', 'Ad'], boardCards: [] },
    });
  }
  assert.equal(repository.list().length, 50);
  assert.equal(repository.list()[0].id, 'hand-54');
});
