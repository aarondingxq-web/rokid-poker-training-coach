import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createHandState,
  getStreet,
  setCardAtSlot,
  validateHandState,
} from '../src/hand-state.js';

test('maps legal board counts to streets', () => {
  assert.equal(getStreet([]), 'preflop');
  assert.equal(getStreet(['2c', '3d', '4h']), 'flop');
  assert.equal(getStreet(['2c', '3d', '4h', '5s']), 'turn');
  assert.equal(getStreet(['2c', '3d', '4h', '5s', '6c']), 'river');
  assert.equal(getStreet(['2c']), 'invalid');
});

test('updates slots without mutating the previous state', () => {
  const initial = createHandState();
  const result = setCardAtSlot(initial, 'hero0', 'As');
  assert.equal(initial.heroCards[0], null);
  assert.equal(result.state.heroCards[0], 'As');
  assert.equal(result.error, undefined);
});

test('rejects duplicate cards and board gaps', () => {
  let state = setCardAtSlot(createHandState(), 'hero0', 'As').state;
  const duplicate = setCardAtSlot(state, 'hero1', 'As');
  assert.match(duplicate.error, /重复牌/);

  state = setCardAtSlot(state, 'board1', 'Kd').state;
  const validation = validateHandState(state);
  assert.equal(validation.valid, false);
  assert.ok(validation.warnings.includes('公共牌必须从翻牌第一张开始连续填写'));
});
