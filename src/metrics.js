import { remainingDeck } from './cards.js';
import {
  DEFAULT_MONTE_CARLO_SAMPLES,
  DEFAULT_RANDOM_SEED,
  MAX_MONTE_CARLO_SAMPLES,
  OUTS_BOARD_COUNTS,
} from './constants.js';
import { assertCalculableHand } from './hand-state.js';
import { compareHands, evaluateBestHand } from './poker.js';

function createRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function drawWithoutReplacement(deck, count, random) {
  const pool = [...deck];
  for (let index = 0; index < count; index += 1) {
    const selected = index + Math.floor(random() * (pool.length - index));
    [pool[index], pool[selected]] = [pool[selected], pool[index]];
  }
  return pool.slice(0, count);
}

export function calculatePotOdds(potSize, amountToCall) {
  if (potSize === undefined || amountToCall === undefined) return undefined;
  if (!Number.isFinite(potSize) || !Number.isFinite(amountToCall)) return undefined;
  if (potSize < 0 || amountToCall < 0) return undefined;
  if (amountToCall === 0) return 0;
  return amountToCall / (potSize + amountToCall);
}

export function countImmediateOuts(heroCards, boardCards) {
  assertCalculableHand(heroCards, boardCards);
  if (!OUTS_BOARD_COUNTS.includes(boardCards.length)) {
    return {
      count: 0,
      cards: [],
      definition: '下一张牌令当前最佳牌型等级提升的未见牌',
    };
  }

  const known = [...heroCards, ...boardCards];
  const baseline = evaluateBestHand(known);
  const cards = remainingDeck(known).filter((candidate) => {
    const improved = evaluateBestHand([...known, candidate]);
    return improved.category > baseline.category;
  });
  return {
    count: cards.length,
    cards,
    definition: '下一张牌令当前最佳牌型等级提升的未见牌',
  };
}

export function estimateHeadsUpEquity(
  heroCards,
  boardCards,
  { samples = DEFAULT_MONTE_CARLO_SAMPLES, seed = DEFAULT_RANDOM_SEED } = {},
) {
  assertCalculableHand(heroCards, boardCards);
  if (!Number.isInteger(samples) || samples < 1 || samples > MAX_MONTE_CARLO_SAMPLES) {
    throw new RangeError(`模拟次数必须是 1 到 ${MAX_MONTE_CARLO_SAMPLES} 的整数`);
  }

  const known = [...heroCards, ...boardCards];
  const deck = remainingDeck(known);
  const missingBoardCards = 5 - boardCards.length;
  const drawCount = 2 + missingBoardCards;
  const random = createRandom(seed);
  let wins = 0;
  let ties = 0;

  for (let index = 0; index < samples; index += 1) {
    const drawn = drawWithoutReplacement(deck, drawCount, random);
    const opponent = drawn.slice(0, 2);
    const completedBoard = [...boardCards, ...drawn.slice(2)];
    const heroHand = evaluateBestHand([...heroCards, ...completedBoard]);
    const opponentHand = evaluateBestHand([...opponent, ...completedBoard]);
    const comparison = compareHands(heroHand, opponentHand);
    if (comparison > 0) wins += 1;
    else if (comparison === 0) ties += 1;
  }

  const equity = (wins + ties * 0.5) / samples;
  const halfWidth = Math.min(0.5, 1.96 * Math.sqrt((equity * (1 - equity)) / samples));
  return {
    equity,
    low: Math.max(0, equity - halfWidth),
    high: Math.min(1, equity + halfWidth),
    samples,
    wins,
    ties,
    assumption: '随机单一对手',
  };
}
