import { parseCard, validateKnownCards } from './cards.js';
import { HAND_CATEGORY } from './constants.js';

const RANK_VALUES = Object.freeze({
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
});

const CATEGORY_NAMES = Object.freeze({
  [HAND_CATEGORY.HIGH_CARD]: '高牌',
  [HAND_CATEGORY.ONE_PAIR]: '一对',
  [HAND_CATEGORY.TWO_PAIR]: '两对',
  [HAND_CATEGORY.THREE_OF_A_KIND]: '三条',
  [HAND_CATEGORY.STRAIGHT]: '顺子',
  [HAND_CATEGORY.FLUSH]: '同花',
  [HAND_CATEGORY.FULL_HOUSE]: '葫芦',
  [HAND_CATEGORY.FOUR_OF_A_KIND]: '四条',
  [HAND_CATEGORY.STRAIGHT_FLUSH]: '同花顺',
});

function straightHigh(ranks) {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index - 1] - unique[index] === 1) {
      run += 1;
      if (run >= 5) return unique[index - 4];
    } else {
      run = 1;
    }
  }
  return undefined;
}

function evaluateFiveCardHand(cards) {
  const parsed = cards.map(parseCard);
  const ranks = parsed.map((card) => RANK_VALUES[card.rank]);
  const flush = parsed.every((card) => card.suit === parsed[0].suit);
  const highStraight = straightHigh(ranks);

  const counts = new Map();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort(
    ([rankA, countA], [rankB, countB]) => countB - countA || rankB - rankA,
  );

  let category;
  let tiebreak;
  if (flush && highStraight !== undefined) {
    category = HAND_CATEGORY.STRAIGHT_FLUSH;
    tiebreak = [highStraight];
  } else if (groups[0][1] === 4) {
    category = HAND_CATEGORY.FOUR_OF_A_KIND;
    tiebreak = [groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    category = HAND_CATEGORY.FULL_HOUSE;
    tiebreak = [groups[0][0], groups[1][0]];
  } else if (flush) {
    category = HAND_CATEGORY.FLUSH;
    tiebreak = [...ranks].sort((a, b) => b - a);
  } else if (highStraight !== undefined) {
    category = HAND_CATEGORY.STRAIGHT;
    tiebreak = [highStraight];
  } else if (groups[0][1] === 3) {
    category = HAND_CATEGORY.THREE_OF_A_KIND;
    tiebreak = [groups[0][0], ...groups.slice(1).map(([rank]) => rank).sort((a, b) => b - a)];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    category = HAND_CATEGORY.TWO_PAIR;
    tiebreak = [...pairs, groups[2][0]];
  } else if (groups[0][1] === 2) {
    category = HAND_CATEGORY.ONE_PAIR;
    tiebreak = [groups[0][0], ...groups.slice(1).map(([rank]) => rank).sort((a, b) => b - a)];
  } else {
    category = HAND_CATEGORY.HIGH_CARD;
    tiebreak = [...ranks].sort((a, b) => b - a);
  }

  return { category, name: CATEGORY_NAMES[category], tiebreak, cards: [...cards] };
}

function combinations(items, choose) {
  const result = [];
  const current = [];
  function visit(start) {
    if (current.length === choose) {
      result.push([...current]);
      return;
    }
    for (let index = start; index <= items.length - (choose - current.length); index += 1) {
      current.push(items[index]);
      visit(index + 1);
      current.pop();
    }
  }
  visit(0);
  return result;
}

export function compareHands(left, right) {
  if (left.category !== right.category) return left.category > right.category ? 1 : -1;
  const length = Math.max(left.tiebreak.length, right.tiebreak.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left.tiebreak[index] ?? 0;
    const rightValue = right.tiebreak[index] ?? 0;
    if (leftValue !== rightValue) return leftValue > rightValue ? 1 : -1;
  }
  return 0;
}

export function evaluateBestHand(cards) {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) {
    throw new RangeError('牌型计算需要 5 到 7 张牌');
  }
  const validation = validateKnownCards(cards);
  if (!validation.valid) throw new RangeError(validation.error);

  const candidates = combinations(cards, 5).map(evaluateFiveCardHand);
  return candidates.reduce((best, candidate) =>
    compareHands(candidate, best) > 0 ? candidate : best,
  );
}
