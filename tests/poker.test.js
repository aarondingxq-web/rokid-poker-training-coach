import assert from 'node:assert/strict';
import test from 'node:test';

import { compareHands, evaluateBestHand } from '../src/poker.js';

const examples = [
  [['As', 'Ks', 'Qs', 'Js', 'Ts'], 8, '同花顺'],
  [['As', 'Ad', 'Ah', 'Ac', '2s'], 7, '四条'],
  [['Ks', 'Kd', 'Kh', '2c', '2d'], 6, '葫芦'],
  [['As', 'Js', '8s', '4s', '2s'], 5, '同花'],
  [['9s', '8d', '7h', '6c', '5s'], 4, '顺子'],
  [['As', 'Ad', 'Ah', '7c', '2s'], 3, '三条'],
  [['As', 'Ad', 'Kh', 'Kc', '2s'], 2, '两对'],
  [['As', 'Ad', 'Kh', '7c', '2s'], 1, '一对'],
  [['As', 'Kd', '9h', '7c', '2s'], 0, '高牌'],
];

for (const [cards, category, name] of examples) {
  test(`evaluates ${name}`, () => {
    const result = evaluateBestHand(cards);
    assert.equal(result.category, category);
    assert.equal(result.name, name);
  });
}

test('recognizes the ace-to-five wheel straight', () => {
  const result = evaluateBestHand(['As', '2d', '3h', '4c', '5s']);
  assert.equal(result.name, '顺子');
  assert.deepEqual(result.tiebreak, [5]);
});

test('selects the best five cards from seven', () => {
  const result = evaluateBestHand(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '2c']);
  assert.equal(result.name, '同花顺');
});

test('compares kickers after the made hand', () => {
  const kingKicker = evaluateBestHand(['As', 'Ad', 'Kh', '7c', '2s']);
  const queenKicker = evaluateBestHand(['Ac', 'Ah', 'Qh', '7d', '2c']);
  assert.equal(compareHands(kingKicker, queenKicker), 1);
});
