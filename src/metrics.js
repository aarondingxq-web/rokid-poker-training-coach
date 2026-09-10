import { remainingDeck, validateKnownCards } from './cards.js';
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

function assertCalculable(heroCards, boardCards) {
  if (heroCards.length !== 2) throw new RangeError('权益计算需要两张手牌');
  if (![0, 3, 4, 5].includes(boardCards.length)) {
    throw new RangeError('公共牌数量必须为 0、3、4 或 5 张');
  }
  const validation = validateKnownCards([...heroCards, ...boardCards]);
  if (!validation.valid) throw new RangeError(validation.error);
}

export function calculatePotOdds(potSize, amountToCall) {
  if (potSize === undefined || amountToCall === undefined) return undefined;
  if (!Number.isFinite(potSize) || !Number.isFinite(amountToCall)) return undefined;
  if (potSize < 0 || amountToCall < 0) return undefined;
  if (amountToCall === 0) return 0;
  return amountToCall / (potSize + amountToCall);
}

export function countImmediateOuts(heroCards, boardCards) {
  assertCalculable(heroCards, boardCards);
  if (![3, 4].includes(boardCards.length)) {
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
  { samples = 800, seed = 20260910 } = {},
) {
  assertCalculable(heroCards, boardCards);
  if (!Number.isInteger(samples) || samples < 1 || samples > 100000) {
    throw new RangeError('模拟次数必须是 1 到 100000 的整数');
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
