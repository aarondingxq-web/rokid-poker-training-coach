import assert from 'node:assert/strict';
import test from 'node:test';

import { canCommitRecognition, normalizeCandidate } from '../src/recognition.js';

test('normalizes a valid recognition candidate', () => {
  assert.deepEqual(normalizeCandidate({ card: 'As', confidence: 0.91234 }), {
    card: 'As',
    confidence: 0.9123,
  });
});

test('requires explicit confirmation and the confidence threshold', () => {
  assert.equal(canCommitRecognition({ confirmed: true, confidence: 0.84 }), false);
  assert.equal(canCommitRecognition({ confirmed: false, confidence: 0.99 }), false);
  assert.equal(canCommitRecognition({ confirmed: true, confidence: 0.85 }), true);
});
