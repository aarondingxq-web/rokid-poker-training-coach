import { validateKnownCards } from './cards.js';
import { LEGAL_BOARD_COUNTS } from './constants.js';

export const HISTORY_KEY = 'rokid-poker-training-history-v1';
const MAX_RECORDS = 50;
const RAW_MEDIA_KEYS = new Set(['rawImage', 'rawVideo', 'imageData', 'videoData', 'frameBuffer']);

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function isHistoryRecord(record) {
  if (!isObject(record) || record.confirmed !== true || record.validated !== true) return false;
  if (typeof record.id !== 'string' || record.id.length === 0) return false;
  if (typeof record.createdAt !== 'string' || Number.isNaN(Date.parse(record.createdAt))) return false;
  if (!isObject(record.state)) return false;

  const { heroCards, boardCards } = record.state;
  if (!Array.isArray(heroCards) || heroCards.length !== 2) return false;
  if (!Array.isArray(boardCards) || !LEGAL_BOARD_COUNTS.includes(boardCards.length)) return false;
  if ([...heroCards, ...boardCards].some((card) => typeof card !== 'string')) return false;
  return validateKnownCards([...heroCards, ...boardCards]).valid;
}

function containsRawMedia(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (RAW_MEDIA_KEYS.has(key)) return true;
    if (containsRawMedia(child)) return true;
  }
  return false;
}

export function createHistoryRepository(storage) {
  function read() {
    try {
      const stored = storage.getStorageSync(HISTORY_KEY);
      return Array.isArray(stored) ? stored.filter(isHistoryRecord) : [];
    } catch {
      return [];
    }
  }

  function write(records) {
    storage.setStorageSync(HISTORY_KEY, records);
  }

  return {
    list() {
      return read().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    save(record) {
      if (!isObject(record) || record.confirmed !== true) {
        throw new Error('只有人工确认的牌局可以保存');
      }
      if (record.validated !== true) throw new Error('只有牌面合法的牌局可以保存');
      if (containsRawMedia(record)) throw new Error('历史记录不得包含原始媒体');
      if (!isHistoryRecord(record)) throw new Error('历史记录格式无效');
      const records = [record, ...read().filter((item) => item.id !== record.id)]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, MAX_RECORDS);
      write(records);
      return records;
    },
    clear() {
      write([]);
    },
  };
}
