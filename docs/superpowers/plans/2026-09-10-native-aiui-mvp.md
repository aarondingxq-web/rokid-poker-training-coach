# Rokid Poker Training Coach 原生 AIUI MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use task-by-task implementation with tests after each independently verifiable component. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可直接导入 Rokid AIUI Studio Craft 的德州扑克训练与赛后复盘智能体；第一版无需摄像头和 API Key，即可手工录牌、计算客观指标并保存本地历史。

**Architecture:** 项目采用 Rokid Open Agent Format，而不是 React/Vite。全屏 Page 使用 `.ink` 单文件组件；纯 JavaScript 领域模块负责牌面校验、牌型、outs、权益和底池赔率；`wx` 存储只在页面适配层出现，确保核心逻辑可在 Node 中测试。

**Tech Stack:** Rokid AIUI/OAF、Ink `.ink`、ES modules、`wx` storage、Node.js built-in test runner、`@yodaos-pkg/aix-cli`。

## Global Constraints

- 产品仅用于娱乐、训练和一手牌结束后的复盘，不提供实时下注行动或下注金额。
- 不接入扑克平台，不抓屏，不自动执行操作，不处理资金。
- 不保存原始摄像头媒体；第一版只保存用户确认的结构化手牌。
- 目标界面为 Rokid Glasses 480×352 单绿色透明显示，核心内容置于安全区。
- 只使用 AIUI 官方确认的组件、事件、WXSS 属性和 `wx` API。
- 无摄像头、无网络、无 AI Key 时，确定性核心流程必须完整可用。
- 权益必须标注“随机单一对手”假设；Monte Carlo 结果必须展示样本数。
- `npm test`、`npm run validate`、`npm run build` 必须通过；`build` 生成可检查的 `.aix` 包。

## 文件结构

```text
rokid-poker-training-coach/
├── AGENTS.md                         # 智能体身份、边界和能力说明
├── app.js                            # 应用生命周期与全局数据
├── app.json                          # OAF 页面与窗口配置
├── package.json                      # 测试、校验、AIX 打包命令
├── .aixignore                        # 排除测试、文档、node_modules、dist
├── README.md                         # 导入、开发、验证、隐私与限制
├── pages/index/index.ink             # 手工录牌、HUD、历史的全屏页面
├── src/cards.js                      # 牌、牌组、解析、格式化与去重
├── src/poker.js                      # 5–7 张牌型评估与比较
├── src/metrics.js                    # 街道、outs、权益、底池赔率
├── src/hand-state.js                 # 手牌状态、槽位更新与保存校验
├── src/history.js                    # 注入式结构化历史仓库
├── src/recognition.js                # 未来本地识牌结果的确认边界
├── scripts/validate.mjs              # OAF、JSON、.ink、引用路径静态校验
└── tests/*.test.js                   # 领域与仓库测试
```

---

### Task 1: 创建原生 OAF 工程骨架

**Files:**
- Create: `AGENTS.md`
- Create: `app.js`
- Create: `app.json`
- Create: `package.json`
- Create: `.aixignore`

**Interfaces:**
- Consumes: Rokid AIUI 官方项目结构。
- Produces: 默认路由 `pages/index/index` 和可重复执行的测试、校验、打包命令。

- [ ] **Step 1: 写入合法的应用清单**

```json
{
  "pages": ["pages/index/index"],
  "window": { "navigationBarTitleText": "扑克训练教练" }
}
```

- [ ] **Step 2: 配置验证与 AIX 打包**

```json
{
  "type": "module",
  "scripts": {
    "test": "node --test",
    "validate": "node scripts/validate.mjs",
    "build": "npm test && npm run validate && aix pack . -o dist/rokid-poker-training-coach.aix"
  }
}
```

- [ ] **Step 3: 运行 JSON 解析检查**

Run: `node -e "JSON.parse(require('fs').readFileSync('app.json','utf8'))"`

Expected: exit code `0`。

### Task 2: 牌面模型与状态校验

**Files:**
- Create: `src/cards.js`
- Create: `src/hand-state.js`
- Test: `tests/cards.test.js`
- Test: `tests/hand-state.test.js`

**Interfaces:**
- Consumes: 卡牌字符串，例如 `As`、`Td`。
- Produces: `createDeck()`, `parseCard(code)`, `validateKnownCards(cards)`, `createHandState()`, `setCardAtSlot(state, slot, code)`, `getStreet(boardCards)`。

- [ ] **Step 1: 写失败测试覆盖 52 张牌、解析、重复牌、非法公共牌数量**

```javascript
assert.equal(createDeck().length, 52);
assert.deepEqual(parseCard('As'), { rank: 'A', suit: 's' });
assert.equal(validateKnownCards(['As', 'As']).valid, false);
assert.equal(getStreet(['2c', '3d', '4h']), 'flop');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/cards.test.js tests/hand-state.test.js`

Expected: module-not-found failure。

- [ ] **Step 3: 实现最小领域模型与不可变状态更新**

```javascript
export const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
export const SUITS = ['c','d','h','s'];
export function cardKey(card) { return `${card.rank}${card.suit}`; }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/cards.test.js tests/hand-state.test.js`

Expected: all tests pass。

### Task 3: 牌型、outs、权益和底池赔率

**Files:**
- Create: `src/poker.js`
- Create: `src/metrics.js`
- Test: `tests/poker.test.js`
- Test: `tests/metrics.test.js`

**Interfaces:**
- Consumes: 两张 hero 手牌、0–5 张公共牌、可选底池与跟注额。
- Produces: `evaluateBestHand(cards)`, `compareHands(a,b)`, `countImmediateOuts(hero,board)`, `estimateHeadsUpEquity(hero,board,options)`, `calculatePotOdds(pot,toCall)`。

- [ ] **Step 1: 写失败测试覆盖九类牌型、踢脚比较、轮子顺子、平分底池**

```javascript
assert.equal(evaluateBestHand(['As','Ks','Qs','Js','Ts']).category, 8);
assert.equal(evaluateBestHand(['As','2d','3h','4c','5s']).name, '顺子');
assert.equal(compareHands(acesWithKing, acesWithQueen), 1);
```

- [ ] **Step 2: 写失败测试覆盖 outs、权益边界与底池赔率**

```javascript
assert.equal(countImmediateOuts(['Ah','Kh'], ['Qh','Jh','Tc']).count, 9);
assert.equal(calculatePotOdds(100, 25), 0.2);
assert.equal(calculatePotOdds(undefined, 25), undefined);
```

- [ ] **Step 3: 实现 5 张组合枚举、确定性 PRNG 和 Monte Carlo**

```javascript
export function estimateHeadsUpEquity(hero, board, { samples = 800, seed = 20260910 } = {}) {
  // 每次模拟从未见牌中抽对手两张和剩余公共牌；tie 计 0.5。
}
```

- [ ] **Step 4: 运行领域测试**

Run: `node --test tests/poker.test.js tests/metrics.test.js`

Expected: all tests pass，固定 seed 结果可重复。

### Task 4: 本地结构化历史与识牌确认边界

**Files:**
- Create: `src/history.js`
- Create: `src/recognition.js`
- Test: `tests/history.test.js`
- Test: `tests/recognition.test.js`

**Interfaces:**
- Consumes: 具有 `getStorageSync`/`setStorageSync` 的存储适配器和识别候选。
- Produces: `createHistoryRepository(storage)`, `normalizeCandidate(candidate)`, `canCommitRecognition(result, threshold)`。

- [ ] **Step 1: 写失败测试覆盖只保存确认记录、损坏存储回退、0.85 阈值**

```javascript
assert.equal(canCommitRecognition({ confirmed: true, confidence: 0.84 }), false);
assert.deepEqual(repository.list(), []);
```

- [ ] **Step 2: 实现最多 50 条的纯结构化历史仓库**

```javascript
export const HISTORY_KEY = 'rokid-poker-training-history-v1';
```

- [ ] **Step 3: 运行相关测试**

Run: `node --test tests/history.test.js tests/recognition.test.js`

Expected: all tests pass。

### Task 5: 构建 480×352 原生 AIUI 页面

**Files:**
- Create: `pages/index/index.ink`

**Interfaces:**
- Consumes: 领域模块和 `import wx from 'wx'`。
- Produces: HUD、牌槽选择、点按式牌面编辑、数字输入、保存与历史浏览。

- [ ] **Step 1: 添加 `.ink` 四段结构和页面状态**

```html
<script def>{ "navigationBarTitleText": "扑克训练教练" }</script>
<script setup>
import wx from 'wx';
export default { data: { view: 'hud' } };
</script>
<page><view class="app-shell">...</view></page>
<style>.app-shell { width: 100%; height: 100%; display: flex; }</style>
```

- [ ] **Step 2: 实现 HUD，只显示客观训练指标**

界面仅展示牌型、街道、即时 outs、随机单对手权益、样本数、底池赔率和假设说明；不出现“跟注/弃牌/下注/加注/最佳行动”。

- [ ] **Step 3: 实现点按编辑与低置信度确认状态**

牌面通过槽位、点数、花色三步选择；重复牌产生显式 `WARN` 文案与虚线框，不写入状态。

- [ ] **Step 4: 实现 `wx` 本地历史**

只有用户点击“记录本手”且牌面合法时，保存确认后的结构化快照。

### Task 6: 静态校验、打包与文档

**Files:**
- Create: `scripts/validate.mjs`
- Create: `README.md`

**Interfaces:**
- Consumes: 完整 OAF 工程。
- Produces: `dist/rokid-poker-training-coach.aix` 和可复现的导入说明。

- [ ] **Step 1: 实现静态校验脚本**

校验 `app.json`、页面路径、`.ink` 四段结构、配置 JSON、默认导出、事件处理器、项目内 import，并扫描废弃注册和禁止的实时行动文案。

- [ ] **Step 2: 运行全部测试和校验**

Run: `npm test && npm run validate`

Expected: tests pass；validator 输出 `AIUI project validation passed.`。

- [ ] **Step 3: 生成并检查 AIX**

Run: `npm run build && npm run inspect`

Expected: 包中包含 `AGENTS.md`、`app.json`、`app.js`、`pages/index/index.ink` 与 `src/*.js`，不包含 `tests/`、`docs/`、`node_modules/`、`dist/`。

- [ ] **Step 4: 编写 AIUI Studio 导入说明**

README 必须说明两种路径：Craft 直接导入本地工程文件夹；或推送 GitHub 后导入包含 `app.json` 的仓库子目录。硬件摄像头与真机渲染明确标记为尚未验证。

## 后续阶段（不阻塞 MVP）

1. 在用户交互触发下调用 `wx.media.createCameraContext().takePhoto()`，只在内存中处理 `ArrayBuffer`。
2. 将本地识牌模型包装为候选结果；低于 0.85 或未确认时不得写入状态和历史。
3. 增加赛后复盘服务；只发送确认后的结构化数据，不发送图像，不输出实时行动或具体下注金额。
4. 在 Rokid Glasses 真机验证摄像头权限、耗时、温升、识别率、焦点路径和透明背景可读性。
