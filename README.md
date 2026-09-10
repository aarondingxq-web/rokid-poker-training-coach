# Rokid Poker Training Coach

面向 Rokid Glasses 的原生 AIUI 德州扑克训练与赛后复盘智能体。当前 MVP 不依赖摄像头、网络或 API Key：用户手工确认牌面后，可在眼镜 HUD 中查看客观训练指标，并把结构化记录保存在设备本地。

## 当前能力

- 两张手牌与 0、3、4、5 张公共牌的点按式录入。
- 重复牌、牌槽间断和低置信度识别结果的保存拦截。
- 九类德州扑克牌型与完整踢脚比较。
- 下一张牌令“当前最佳牌型等级提升”的即时 outs。
- 基于固定种子的随机单一对手 Monte Carlo 权益区间，默认 800 次模拟。
- 可选底池与需投入金额；按 `需投入 ÷（底池 + 需投入）` 计算底池赔率。
- 最多 50 条用户确认的结构化本地历史。
- 480×352 单绿色透明显示的低干扰 HUD。

本项目不会连接扑克平台、抓屏、自动操作或处理资金，也不会提供下注、加注、跟注、弃牌指令或具体下注金额。

## 技术结构

本项目使用 Rokid Open Agent Format，而不是 React/Vite：

```text
AGENTS.md
app.js
app.json
pages/index/index.ink
src/
```

`pages/index/index.ink` 是全屏交互页面。`src/` 中的牌面、牌型、概率和状态逻辑是无平台依赖的 ES modules；只有页面通过 `import wx from 'wx'` 访问 AIUI 本地存储。

## 本地验证

需要 Node.js 20 或更高版本。

```bash
npm install
npm test
npm run validate
npm run build
npm run inspect
```

- `npm test`：运行领域与隐私边界测试。
- `npm run validate`：检查 OAF 路由、`.ink` 结构、JavaScript、模块引用、事件处理器和 WXSS 支持范围。
- `npm run build`：重复运行测试与校验，然后生成 `dist/rokid-poker-training-coach.aix`。
- `npm run inspect`：列出 AIX 包内容，确认测试、文档和 `node_modules` 未被打包。

可选本地预览：

```bash
npm run preview
```

预览使用 `@yodaos-pkg/aix-cli` 的浏览器 Ink SDK；它不能替代真机摄像头、焦点路径和透明背景可读性验证。

## 导入 AIUI Studio

商店提审素材位于 `assets/`，包括应用图标、三张真实 Ink 预览截图和一段 MP4 演示视频。该目录已加入 `.aixignore`，不会进入运行时 AIX 包。

### 本地文件夹

1. 打开 [AIUI Studio Craft](https://aiui.rokid.com/)。
2. 选择导入本地文件夹。
3. 选择本目录，也就是直接包含 `app.json` 的 `rokid-poker-training-coach/`。
4. 在 Craft 中运行和调试。

### GitHub

1. 将本目录推送到 GitHub 仓库。
2. 在 Craft 的“GitHub 子目录导入”中选择 GitHub。
3. 如果本项目位于仓库根目录，粘贴仓库地址，例如：

   ```text
   https://github.com/aarondingxq-web/rokid-poker-training-coach
   ```

4. 如果位于仓库子目录，粘贴 `tree` 地址，例如：

   ```text
   https://github.com/<owner>/<repo>/tree/main/path/to/rokid-poker-training-coach
   ```

Craft 的 GitHub 导入按只读源处理；后续代码修改应在本地或 GitHub 完成，再重新导入或同步。

## 使用方式

1. 进入“录牌”，依次选择牌槽、点数和花色。
2. 进入“参数”，按需填写底池、需投入和有效筹码。
3. 返回 HUD 查看牌型、outs、权益区间和底池赔率。
4. 牌面合法时点击“记录本手”，只保存结构化快照。
5. 在“历史”中查看此前记录。

## 计算口径

- 权益假设只有一个随机对手，不代表真实对手范围。
- 权益区间是 Monte Carlo 抽样的近似置信区间，不是精确事实。
- outs 定义为“下一张牌令当前最佳牌型等级提升的未见牌”。它不尝试推断对手范围，也不把同牌型内的踢脚变化当作 outs。
- 缺少底池或需投入时，底池赔率显示“待补充”。

## 隐私与安全边界

- 当前版本不调用摄像头。
- 历史仓库拒绝包含原始图片、视频或帧缓存字段的记录。
- 没有任何 API Key 或服务端依赖。
- 未来识牌会通过单独适配层接入；置信度低于 `0.85` 或未人工确认时，不得提交到手牌状态。
- 未来 AI 复盘只允许发送已确认的结构化数据，不发送图像或视频。

## 尚未验证

- Rokid Glasses 真机上的字体、焦点顺序、透明背景可读性和输入体验。
- 相机权限、取帧耗时、模型识别准确率、功耗与温升。
- 云端赛后复盘服务。

这些项目属于后续阶段，不影响无摄像头、无网络的 MVP 使用。
