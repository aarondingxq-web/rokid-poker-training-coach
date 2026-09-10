import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RANKS,
  SUITS,
  cardLabel,
  createDeck,
  parseCard,
  validateKnownCards,
} from '../src/cards.js';

test('creates a unique 52-card deck', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck).size, 52);
  assert.equal(deck.length, RANKS.length * SUITS.length);
});

test('parses and labels canonical card codes', () => {
  assert.deepEqual(parseCard('As'), { rank: 'A', suit: 's' });
  assert.equal(cardLabel('Td'), 'T♦');
});

test('rejects malformed and duplicate cards', () => {
  assert.throws(() => parseCard('10s'), /非法牌面/);
  assert.deepEqual(validateKnownCards(['As', 'As']), {
    valid: false,
    error: '发现重复牌：A♠',
  });
});
