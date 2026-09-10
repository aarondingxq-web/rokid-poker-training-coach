<script type="application/json" def>
{
  "navigationBarTitleText": "扑克训练教练",
  "description": "记录已确认的德州扑克牌面并显示客观训练指标。"
}
</script>

<script setup>
import wx from 'wx';

import { RANKS, SUITS, cardLabel } from '../../src/cards.js';
import {
  CARD_SLOTS,
  createHandState,
  numericValue,
  setCardAtSlot,
  validateHandState,
} from '../../src/hand-state.js';
import { createHistoryRepository } from '../../src/history.js';
import {
  calculatePotOdds,
  countImmediateOuts,
  estimateHeadsUpEquity,
} from '../../src/metrics.js';
import { evaluateBestHand } from '../../src/poker.js';

const historyRepository = createHistoryRepository(wx);
const SLOT_LABELS = {
  hero0: '手牌 1',
  hero1: '手牌 2',
  board0: '翻牌 1',
  board1: '翻牌 2',
  board2: '翻牌 3',
  board3: '转牌',
  board4: '河牌',
};
const STREET_LABELS = {
  preflop: '翻前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
  invalid: '待补充',
};
const SUIT_LABELS = { c: '♣', d: '♦', h: '♥', s: '♠' };

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function fixedSlots(state, selectedSlot) {
  return CARD_SLOTS.map((slot) => {
    const isHero = slot.startsWith('hero');
    const index = Number(slot[slot.length - 1]);
    const code = isHero ? state.heroCards[index] : state.boardCards[index];
    return {
      slot,
      label: SLOT_LABELS[slot],
      value: code ? cardLabel(code) : '--',
      className: slot === selectedSlot ? 'card-slot selected-slot' : 'card-slot',
    };
  });
}

function nextSlot(current, state) {
  const currentIndex = CARD_SLOTS.indexOf(current);
  for (let offset = 1; offset <= CARD_SLOTS.length; offset += 1) {
    const slot = CARD_SLOTS[(currentIndex + offset) % CARD_SLOTS.length];
    const isHero = slot.startsWith('hero');
    const index = Number(slot[slot.length - 1]);
    const code = isHero ? state.heroCards[index] : state.boardCards[index];
    if (!code) return slot;
  }
  return current;
}

function seedFor(state) {
  const text = [...state.heroCards, ...state.boardCards].filter(Boolean).join('');
  let seed = 2166136261;
  for (const character of text) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function calculatePresentation(state) {
  const validation = validateHandState(state);
  const heroCards = state.heroCards.filter(Boolean);
  const boardCards = state.boardCards.filter(Boolean);
  let handLabel = boardCards.length === 0 ? '翻前未成牌' : '待补充';
  let outsLabel = '待补充';
  let equityLabel = '待补充';
  let sampleLabel = '需要两张手牌与合法公共牌';

  if (heroCards.length === 2 && [0, 3, 4, 5].includes(boardCards.length)) {
    if (heroCards.length + boardCards.length >= 5) {
      handLabel = evaluateBestHand([...heroCards, ...boardCards]).name;
    }
    if ([3, 4].includes(boardCards.length)) {
      outsLabel = String(countImmediateOuts(heroCards, boardCards).count);
    } else if (boardCards.length === 5) {
      outsLabel = '已到河牌';
    } else {
      outsLabel = '翻牌后计算';
    }
    const equity = estimateHeadsUpEquity(heroCards, boardCards, {
      samples: 800,
      seed: seedFor(state),
    });
    equityLabel = `${percent(equity.low)}–${percent(equity.high)}`;
    sampleLabel = `${equity.samples} 次模拟 · ${equity.assumption}`;
  }

  const potOdds = calculatePotOdds(
    numericValue(state.potSize),
    numericValue(state.amountToCall),
  );
  return {
    valid: validation.valid,
    warnings: validation.warnings,
    streetLabel: STREET_LABELS[validation.street],
    handLabel,
    outsLabel,
    equityLabel,
    sampleLabel,
    potOddsLabel: potOdds === undefined ? '待补充' : percent(potOdds),
  };
}

function historyRows(records) {
  return records.map((record) => {
    const timestamp = String(record.createdAt);
    return {
      id: record.id,
      createdAt: `${timestamp.slice(5, 10)} ${timestamp.slice(11, 16)}`,
      cards: [...record.state.heroCards, ...record.state.boardCards].map(cardLabel).join('  '),
      summary: `${record.metrics.streetLabel} · ${record.metrics.handLabel} · 权益 ${record.metrics.equityLabel}`,
    };
  });
}

export default {
  data: {
    viewMode: 'hud',
    state: createHandState(),
    selectedSlot: 'hero0',
    selectedRank: '',
    rankOptions: RANKS.map((rank) => ({ rank, className: 'choice-button' })),
    suitOptions: SUITS.map((suit) => ({ suit, label: SUIT_LABELS[suit] })),
    slots: fixedSlots(createHandState(), 'hero0'),
    heroSlots: fixedSlots(createHandState(), 'hero0').slice(0, 2),
    boardSlots: fixedSlots(createHandState(), 'hero0').slice(2),
    streetLabel: '翻前',
    handLabel: '翻前未成牌',
    outsLabel: '翻牌后计算',
    equityLabel: '待补充',
    sampleLabel: '需要两张手牌与合法公共牌',
    potOddsLabel: '待补充',
    canSave: false,
    saveButtonClass: 'disabled-button',
    warnings: ['请完整填写两张手牌'],
    warningText: '请完整填写两张手牌',
    statusText: 'MANUAL · 原始媒体不保存',
    historyRows: [],
    historyCount: 0,
  },

  onLoad() {
    this.refreshHistory();
    this.refreshState(this.data.state);
  },

  refreshHistory() {
    const records = historyRepository.list();
    this.setData({ historyRows: historyRows(records), historyCount: records.length });
  },

  refreshState(state, statusText) {
    const metrics = calculatePresentation(state);
    this.setData({
      state,
      slots: fixedSlots(state, this.data.selectedSlot),
      heroSlots: fixedSlots(state, this.data.selectedSlot).slice(0, 2),
      boardSlots: fixedSlots(state, this.data.selectedSlot).slice(2),
      streetLabel: metrics.streetLabel,
      handLabel: metrics.handLabel,
      outsLabel: metrics.outsLabel,
      equityLabel: metrics.equityLabel,
      sampleLabel: metrics.sampleLabel,
      potOddsLabel: metrics.potOddsLabel,
      canSave: metrics.valid,
      saveButtonClass: metrics.valid ? 'primary-button' : 'disabled-button',
      warnings: metrics.warnings,
      warningText: metrics.warnings[0] || '',
      statusText: statusText || this.data.statusText,
    });
  },

  setView(event) {
    const viewMode = event.currentTarget.attributes['data-view'];
    if (viewMode === 'history') this.refreshHistory();
    this.setData({ viewMode });
  },

  selectSlot(event) {
    const selectedSlot = event.currentTarget.attributes['data-slot'];
    this.setData({
      selectedSlot,
      slots: fixedSlots(this.data.state, selectedSlot),
      statusText: `${SLOT_LABELS[selectedSlot]} · 请选择点数和花色`,
    });
  },

  selectRank(event) {
    const selectedRank = event.currentTarget.attributes['data-rank'];
    this.setData({
      selectedRank,
      rankOptions: RANKS.map((rank) => ({
        rank,
        className: rank === selectedRank ? 'choice-button selected-choice' : 'choice-button',
      })),
      statusText: `${SLOT_LABELS[this.data.selectedSlot]} · 已选 ${selectedRank}`,
    });
  },

  selectSuit(event) {
    if (!this.data.selectedRank) {
      this.setData({ statusText: 'WARN · 请先选择点数' });
      return;
    }
    const suit = event.currentTarget.attributes['data-suit'];
    const code = `${this.data.selectedRank}${suit}`;
    const result = setCardAtSlot(this.data.state, this.data.selectedSlot, code);
    if (result.error) {
      this.setData({ statusText: `WARN · ${result.error}` });
      return;
    }
    const selectedSlot = nextSlot(this.data.selectedSlot, result.state);
    this.setData({
      selectedSlot,
      selectedRank: '',
      rankOptions: RANKS.map((rank) => ({ rank, className: 'choice-button' })),
    });
    this.refreshState(result.state, `OK · 已记录 ${cardLabel(code)}`);
  },

  clearSelected() {
    const result = setCardAtSlot(this.data.state, this.data.selectedSlot, null);
    this.refreshState(result.state, `OK · 已清空 ${SLOT_LABELS[this.data.selectedSlot]}`);
  },

  updateNumber(event) {
    const field = event.currentTarget.attributes['data-field'];
    const state = { ...this.data.state, [field]: event.detail.value };
    this.refreshState(state, 'OK · 参数已更新');
  },

  saveHand() {
    const validation = validateHandState(this.data.state);
    if (!validation.valid) {
      this.setData({ statusText: `WARN · ${validation.warnings[0]}` });
      return;
    }
    const metrics = calculatePresentation(this.data.state);
    const record = {
      id: `hand-${Date.now()}`,
      createdAt: new Date().toISOString(),
      confirmed: true,
      validated: true,
      state: {
        heroCards: validation.heroCards,
        boardCards: validation.boardCards,
        heroPosition: this.data.state.heroPosition,
        potSize: numericValue(this.data.state.potSize),
        amountToCall: numericValue(this.data.state.amountToCall),
        effectiveStack: numericValue(this.data.state.effectiveStack),
      },
      metrics: {
        streetLabel: metrics.streetLabel,
        handLabel: metrics.handLabel,
        outsLabel: metrics.outsLabel,
        equityLabel: metrics.equityLabel,
        sampleLabel: metrics.sampleLabel,
        potOddsLabel: metrics.potOddsLabel,
      },
    };
    try {
      const records = historyRepository.save(record);
      this.setData({
        statusText: 'DONE · 已保存结构化牌局',
        historyRows: historyRows(records),
        historyCount: records.length,
      });
    } catch (error) {
      this.setData({ statusText: `ERROR · ${String(error)}` });
    }
  },

  newHand() {
    const state = createHandState();
    this.setData({ selectedSlot: 'hero0', selectedRank: '', viewMode: 'editor' });
    this.refreshState(state, 'NEW · 已开始新一手');
  },

  clearHistory() {
    historyRepository.clear();
    this.refreshHistory();
    this.setData({ statusText: 'DONE · 本地历史已清空' });
  },
};
</script>

<page>
  <view class="app-shell">
    <view class="top-line">
      <view class="identity-block">
        <text class="eyebrow">POKER TRAINING COACH</text>
        <text class="page-title">{{streetLabel}} · {{handLabel}}</text>
      </view>
      <text class="mode-chip">训练模式</text>
    </view>

    <view class="nav-row">
      <button class="nav-button" bindtap="setView" data-view="hud">HUD</button>
      <button class="nav-button" bindtap="setView" data-view="editor">录牌</button>
      <button class="nav-button" bindtap="setView" data-view="details">参数</button>
      <button class="nav-button" bindtap="setView" data-view="history">历史 {{historyCount}}</button>
    </view>

    <view class="status-line">
      <text class="status-marker">◆</text>
      <text class="status-copy">{{statusText}}</text>
    </view>

    <view class="content" ink:if="{{viewMode === 'hud'}}">
      <view class="card-strip">
        <view class="hero-card" ink:for="{{heroSlots}}" ink:key="slot">
          <text class="slot-label">{{item.label}}</text>
          <text class="hero-value">{{item.value}}</text>
        </view>
        <view class="board-readout">
          <text class="slot-label">公共牌</text>
          <view class="board-row">
            <text class="board-value" ink:for="{{boardSlots}}" ink:key="slot">{{item.value}}</text>
          </view>
        </view>
      </view>

      <view class="metric-grid">
        <view class="metric-cell">
          <text class="metric-label">牌型</text>
          <text class="metric-value">{{handLabel}}</text>
        </view>
        <view class="metric-cell">
          <text class="metric-label">即时 OUTS</text>
          <text class="metric-value">{{outsLabel}}</text>
        </view>
        <view class="metric-cell">
          <text class="metric-label">权益区间</text>
          <text class="metric-value">{{equityLabel}}</text>
        </view>
        <view class="metric-cell">
          <text class="metric-label">底池赔率</text>
          <text class="metric-value">{{potOddsLabel}}</text>
        </view>
      </view>
      <text class="assumption">{{sampleLabel}} · 估算不是事实</text>

      <view class="warning-box" ink:if="{{warnings.length > 0}}">
        <text class="warning-title">△ WARN</text>
        <text class="warning-copy">{{warningText}}</text>
      </view>

      <view class="action-row">
        <button class="{{saveButtonClass}}" bindtap="saveHand" disabled="{{!canSave}}">记录本手</button>
        <button class="outline-button" bindtap="newHand">新一手</button>
      </view>
    </view>

    <view class="content" ink:elif="{{viewMode === 'editor'}}">
      <view class="slot-row">
        <button class="{{item.className}}" ink:for="{{slots}}" ink:key="slot" bindtap="selectSlot" data-slot="{{item.slot}}">
          <text class="slot-label">{{item.label}}</text>
          <text class="slot-value">{{item.value}}</text>
        </button>
      </view>
      <text class="section-label">点数</text>
      <view class="rank-grid">
        <button class="{{item.className}}" ink:for="{{rankOptions}}" ink:key="rank" bindtap="selectRank" data-rank="{{item.rank}}">{{item.rank}}</button>
      </view>
      <text class="section-label">花色</text>
      <view class="suit-row">
        <button class="suit-button" ink:for="{{suitOptions}}" ink:key="suit" bindtap="selectSuit" data-suit="{{item.suit}}">{{item.label}}</button>
        <button class="clear-button" bindtap="clearSelected">清空当前</button>
      </view>
    </view>

    <view class="content" ink:elif="{{viewMode === 'details'}}">
      <text class="section-label">可选参数 · 缺失时不计算依赖指标</text>
      <view class="field-row">
        <view class="field-block">
          <text class="field-label">底池</text>
          <input class="number-input" value="{{state.potSize}}" placeholder="例如 100" maxLength="10" bindinput="updateNumber" data-field="potSize" />
        </view>
        <view class="field-block">
          <text class="field-label">需投入</text>
          <input class="number-input" value="{{state.amountToCall}}" placeholder="例如 25" maxLength="10" bindinput="updateNumber" data-field="amountToCall" />
        </view>
        <view class="field-block">
          <text class="field-label">有效筹码</text>
          <input class="number-input" value="{{state.effectiveStack}}" placeholder="可留空" maxLength="10" bindinput="updateNumber" data-field="effectiveStack" />
        </view>
      </view>
      <view class="explain-box">
        <text class="warning-title">FORMULA</text>
        <text class="explain-copy">底池赔率 = 需投入 ÷（底池 + 需投入）</text>
        <text class="explain-copy">只展示数学门槛，不提供任何行动建议。</text>
      </view>
    </view>

    <view class="content" ink:else>
      <scroll-view class="history-list" scroll-y="true">
        <view class="empty-state" ink:if="{{historyRows.length === 0}}">
          <text class="warning-title">○ EMPTY</text>
          <text class="warning-copy">还没有已确认的结构化牌局。</text>
        </view>
        <view class="history-row" ink:for="{{historyRows}}" ink:key="id">
          <view class="history-heading">
            <text class="history-time">{{item.createdAt}}</text>
            <text class="history-cards">{{item.cards}}</text>
          </view>
          <text class="history-summary">{{item.summary}}</text>
        </view>
      </scroll-view>
      <button class="outline-button" bindtap="clearHistory" disabled="{{historyRows.length === 0}}">清空本地历史</button>
    </view>

    <text class="safety-note">仅供训练与赛后学习 · 不连接扑克平台 · 不提供实时行动或下注金额</text>
  </view>
</page>

<style>
  .app-shell {
    --green-100: #40ff5e;
    --green-72: rgba(64, 255, 94, 0.72);
    --green-48: rgba(64, 255, 94, 0.48);
    --green-24: rgba(64, 255, 94, 0.24);
    --green-12: rgba(64, 255, 94, 0.12);
    --green-06: rgba(64, 255, 94, 0.06);
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    color: var(--green-72);
    background-color: #000000;
  }

  .top-line,
  .nav-row,
  .status-line,
  .card-strip,
  .board-row,
  .metric-grid,
  .action-row,
  .slot-row,
  .rank-grid,
  .suit-row,
  .field-row,
  .history-heading {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .top-line {
    justify-content: space-between;
  }

  .identity-block,
  .content,
  .metric-cell,
  .field-block,
  .explain-box,
  .warning-box,
  .empty-state,
  .history-row {
    display: flex;
    flex-direction: column;
  }

  .identity-block {
    gap: 2px;
  }

  .eyebrow,
  .slot-label,
  .metric-label,
  .section-label,
  .field-label,
  .warning-title,
  .mode-chip {
    font-family: sans-serif;
    font-size: 10px;
    line-height: 13px;
    font-weight: 500;
    color: var(--green-48);
  }

  .page-title {
    font-family: sans-serif;
    font-size: 18px;
    line-height: 21px;
    font-weight: 500;
    color: var(--green-100);
  }

  .mode-chip {
    padding: 4px 8px;
    border: 1px solid var(--green-24);
    border-radius: 4px;
  }

  .nav-row {
    gap: 6px;
  }

  .nav-button,
  .outline-button,
  .primary-button,
  .disabled-button,
  .choice-button,
  .suit-button,
  .clear-button,
  .card-slot {
    box-sizing: border-box;
    color: var(--green-72);
    background-color: #000000;
    border: 1px solid var(--green-24);
    border-radius: 4px;
    text-align: center;
  }

  .nav-button {
    flex-grow: 1;
    height: 27px;
    padding: 2px 6px;
    font-size: 11px;
    line-height: 13px;
  }

  .status-line {
    gap: 6px;
    padding: 3px 8px;
    background-color: var(--green-06);
    border: 1px solid var(--green-12);
    border-radius: 2px;
  }

  .status-marker {
    color: var(--green-100);
    font-size: 8px;
  }

  .status-copy,
  .assumption,
  .safety-note,
  .history-summary,
  .explain-copy,
  .warning-copy {
    font-family: sans-serif;
    font-size: 10px;
    line-height: 13px;
    color: var(--green-48);
  }

  .content {
    flex-grow: 1;
    gap: 7px;
  }

  .card-strip {
    gap: 8px;
  }

  .hero-card {
    width: 64px;
    padding: 6px 8px;
    border: 1px solid var(--green-48);
    border-radius: 4px;
  }

  .hero-value {
    font-family: monospace;
    font-size: 21px;
    line-height: 23px;
    font-weight: 500;
    color: var(--green-100);
  }

  .board-readout {
    flex-grow: 1;
    padding: 6px 8px;
    border: 1px solid var(--green-24);
    border-radius: 4px;
  }

  .board-row {
    gap: 10px;
  }

  .board-value {
    font-family: monospace;
    font-size: 16px;
    line-height: 23px;
    color: var(--green-72);
  }

  .metric-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 6px;
  }

  .metric-cell {
    gap: 2px;
    padding: 7px;
    border: 1px solid var(--green-24);
    border-radius: 4px;
  }

  .metric-value {
    font-family: monospace;
    font-size: 13px;
    line-height: 16px;
    font-weight: 500;
    color: var(--green-100);
  }

  .warning-box,
  .empty-state {
    gap: 2px;
    padding: 6px 8px;
    background-color: var(--green-06);
    border: 1px dashed var(--green-72);
    border-radius: 4px;
  }

  .warning-title {
    color: var(--green-100);
  }

  .action-row {
    gap: 8px;
  }

  .primary-button,
  .disabled-button,
  .outline-button {
    flex-grow: 1;
    height: 31px;
    padding: 5px 12px;
    font-size: 11px;
    line-height: 13px;
    font-weight: 500;
  }

  .primary-button {
    color: #000000;
    background-color: var(--green-100);
    border-color: var(--green-100);
  }

  .disabled-button {
    color: var(--green-24);
    background-color: #000000;
    border: 1px dashed var(--green-12);
  }

  .slot-row {
    gap: 4px;
  }

  .card-slot {
    flex-grow: 1;
    height: 40px;
    padding: 3px 2px;
  }

  .selected-slot,
  .selected-choice {
    color: var(--green-100);
    background-color: var(--green-12);
    border: 2px solid var(--green-72);
  }

  .slot-value {
    font-family: monospace;
    font-size: 13px;
    line-height: 16px;
    color: var(--green-100);
  }

  .rank-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
    gap: 4px;
  }

  .choice-button,
  .suit-button,
  .clear-button {
    height: 28px;
    padding: 3px 5px;
    font-family: monospace;
    font-size: 12px;
    line-height: 14px;
  }

  .suit-row {
    gap: 6px;
  }

  .suit-button {
    flex-grow: 1;
    font-size: 16px;
  }

  .clear-button {
    flex-grow: 2;
    font-family: sans-serif;
    font-size: 11px;
  }

  .field-row {
    gap: 8px;
  }

  .field-block {
    flex-grow: 1;
    gap: 4px;
  }

  .number-input {
    width: 100%;
    height: 36px;
    box-sizing: border-box;
    padding: 7px 10px;
    color: var(--green-72);
    background-color: var(--green-06);
    border: 1px solid var(--green-48);
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
  }

  .explain-box {
    gap: 5px;
    padding: 10px;
    border: 1px solid var(--green-24);
    border-radius: 4px;
  }

  .history-list {
    height: 172px;
  }

  .history-row {
    gap: 3px;
    padding: 7px 0;
    border: 1px solid var(--green-12);
  }

  .history-heading {
    justify-content: space-between;
  }

  .history-time,
  .history-cards {
    font-family: monospace;
    font-size: 10px;
    line-height: 13px;
    color: var(--green-72);
  }

  .safety-note {
    text-align: center;
    color: var(--green-48);
  }
</style>
