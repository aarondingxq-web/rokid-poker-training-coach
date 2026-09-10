import { parseCard, validateKnownCards } from './cards.js';

export const CARD_SLOTS = Object.freeze([
  'hero0',
  'hero1',
  'board0',
  'board1',
  'board2',
  'board3',
  'board4',
]);

export function createHandState() {
  return {
    heroCards: [null, null],
    boardCards: [null, null, null, null, null],
    heroPosition: '',
    potSize: '',
    amountToCall: '',
    effectiveStack: '',
    recognitionConfidence: 1,
    confirmed: true,
  };
}

export function getStreet(boardCards) {
  const count = boardCards.filter(Boolean).length;
  if (count === 0) return 'preflop';
  if (count === 3) return 'flop';
  if (count === 4) return 'turn';
  if (count === 5) return 'river';
  return 'invalid';
}

function resolveSlot(slot) {
  const match = /^(hero|board)(\d)$/.exec(slot);
  if (!match) throw new RangeError(`未知牌槽：${slot}`);
  const [, group, indexText] = match;
  const index = Number(indexText);
  if ((group === 'hero' && index > 1) || (group === 'board' && index > 4)) {
    throw new RangeError(`未知牌槽：${slot}`);
  }
  return { field: group === 'hero' ? 'heroCards' : 'boardCards', index };
}

export function setCardAtSlot(state, slot, code) {
  const { field, index } = resolveSlot(slot);
  if (code !== null) parseCard(code);

  const heroCards = [...state.heroCards];
  const boardCards = [...state.boardCards];
  const target = field === 'heroCards' ? heroCards : boardCards;
  const previous = target[index];
  target[index] = null;

  if (code !== null) {
    const duplicate = [...heroCards, ...boardCards].find((card) => card === code);
    if (duplicate) {
      target[index] = previous;
      return { state, error: `重复牌：${code}` };
    }
  }

  target[index] = code;
  return {
    state: { ...state, heroCards, boardCards },
    error: undefined,
  };
}

export function validateHandState(state) {
  const warnings = [];
  const cards = [...state.heroCards, ...state.boardCards].filter(Boolean);
  const knownCards = validateKnownCards(cards);
  if (!knownCards.valid) warnings.push(knownCards.error);

  const heroCount = state.heroCards.filter(Boolean).length;
  if (heroCount !== 2) warnings.push('请完整填写两张手牌');

  const firstGap = state.boardCards.findIndex((card) => card === null);
  const hasCardAfterGap = firstGap >= 0 && state.boardCards.slice(firstGap + 1).some(Boolean);
  if (hasCardAfterGap) warnings.push('公共牌必须从翻牌第一张开始连续填写');

  if (getStreet(state.boardCards) === 'invalid') {
    warnings.push('公共牌数量必须为 0、3、4 或 5 张');
  }

  if (state.recognitionConfidence < 0.85 || state.confirmed === false) {
    warnings.push('识别结果需要人工确认');
  }

  return {
    valid: warnings.length === 0,
    warnings,
    street: getStreet(state.boardCards),
    heroCards: state.heroCards.filter(Boolean),
    boardCards: state.boardCards.filter(Boolean),
  };
}

export function numericValue(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}
