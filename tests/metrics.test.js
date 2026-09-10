import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculatePotOdds,
  countImmediateOuts,
  estimateHeadsUpEquity,
} from '../src/metrics.js';

test('counts nine flush outs without double counting known cards', () => {
  const result = countImmediateOuts(['Ah', 'Kh'], ['Qh', 'Jh', 'Tc']);
  assert.equal(result.count, 9);
  assert.equal(result.definition, '下一张牌令当前最佳牌型等级提升的未见牌');
});

test('calculates pot odds only from valid inputs', () => {
  assert.equal(calculatePotOdds(100, 25), 0.2);
  assert.equal(calculatePotOdds(undefined, 25), undefined);
  assert.equal(calculatePotOdds(100, 0), 0);
  assert.equal(calculatePotOdds(-1, 20), undefined);
});

test('produces deterministic equity for a fixed seed', () => {
  const first = estimateHeadsUpEquity(['As', 'Ad'], [], { samples: 250, seed: 7 });
  const second = estimateHeadsUpEquity(['As', 'Ad'], [], { samples: 250, seed: 7 });
  assert.deepEqual(first, second);
  assert.equal(first.samples, 250);
  assert.ok(first.equity > 0.7 && first.equity < 0.95);
  assert.ok(first.low <= first.equity && first.high >= first.equity);
});

test('splits ties as half a win', () => {
  const result = estimateHeadsUpEquity(
    ['2c', '3d'],
    ['As', 'Ks', 'Qs', 'Js', 'Ts'],
    { samples: 40, seed: 11 },
  );
  assert.equal(result.equity, 0.5);
});
