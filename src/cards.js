export const RANKS = Object.freeze(['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']);
export const SUITS = Object.freeze(['c', 'd', 'h', 's']);

const SUIT_LABELS = Object.freeze({ c: '♣', d: '♦', h: '♥', s: '♠' });
const CARD_PATTERN = /^[2-9TJQKA][cdhs]$/;

export function parseCard(code) {
  if (typeof code !== 'string' || !CARD_PATTERN.test(code)) {
    throw new RangeError(`非法牌面：${String(code)}`);
  }
  return { rank: code[0], suit: code[1] };
}

export function cardLabel(code) {
  const card = parseCard(code);
  return `${card.rank}${SUIT_LABELS[card.suit]}`;
}

export function createDeck() {
  return RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));
}

export function validateKnownCards(cards) {
  const seen = new Set();
  for (const code of cards.filter(Boolean)) {
    try {
      parseCard(code);
    } catch (error) {
      return { valid: false, error: error.message };
    }
    if (seen.has(code)) {
      return { valid: false, error: `发现重复牌：${cardLabel(code)}` };
    }
    seen.add(code);
  }
  return { valid: true };
}

export function remainingDeck(knownCards) {
  const validation = validateKnownCards(knownCards);
  if (!validation.valid) throw new RangeError(validation.error);
  const known = new Set(knownCards.filter(Boolean));
  return createDeck().filter((card) => !known.has(card));
}
