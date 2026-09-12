import { parseCard } from './cards.js';
import { RECOGNITION_CONFIDENCE_THRESHOLD } from './constants.js';

export { RECOGNITION_CONFIDENCE_THRESHOLD };

export function normalizeCandidate(candidate) {
  parseCard(candidate.card);
  const confidence = Number(candidate.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RangeError('识别置信度必须位于 0 到 1 之间');
  }
  return {
    card: candidate.card,
    confidence: Math.round(confidence * 10000) / 10000,
  };
}

export function canCommitRecognition(result, threshold = RECOGNITION_CONFIDENCE_THRESHOLD) {
  return result?.confirmed === true
    && Number.isFinite(result.confidence)
    && result.confidence >= threshold;
}
