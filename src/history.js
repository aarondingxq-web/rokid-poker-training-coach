export const HISTORY_KEY = 'rokid-poker-training-history-v1';
const MAX_RECORDS = 50;
const RAW_MEDIA_KEYS = new Set(['rawImage', 'rawVideo', 'imageData', 'videoData', 'frameBuffer']);

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
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function write(records) {
    storage.setStorageSync(HISTORY_KEY, records);
  }

  return {
    list() {
      return read().sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    },
    save(record) {
      if (record.confirmed !== true) throw new Error('只有人工确认的牌局可以保存');
      if (record.validated !== true) throw new Error('只有牌面合法的牌局可以保存');
      if (containsRawMedia(record)) throw new Error('历史记录不得包含原始媒体');
      const records = [record, ...read().filter((item) => item.id !== record.id)]
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
        .slice(0, MAX_RECORDS);
      write(records);
      return records;
    },
    clear() {
      write([]);
    },
  };
}
