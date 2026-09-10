import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = ['AGENTS.md', 'app.json', 'app.js', 'package.json'];
const supportedProperties = new Set([
  'display',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'gap',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-auto-columns',
  'grid-auto-rows',
  'grid-auto-flow',
  'grid-column',
  'grid-column-start',
  'grid-column-end',
  'grid-row',
  'grid-row-start',
  'grid-row-end',
  'grid-area',
  'align-content',
  'justify-items',
  'align-self',
  'justify-self',
  'width',
  'height',
  'margin',
  'padding',
  'box-sizing',
  'position',
  'color',
  'background-color',
  'border',
  'border-width',
  'border-style',
  'border-color',
  'border-radius',
  'outline',
  'outline-width',
  'outline-style',
  'outline-color',
  'outline-offset',
  'font-size',
  'line-height',
  'font-weight',
  'font-family',
  'font-style',
  'text-align',
  'opacity',
  'box-shadow',
  'filter',
  'transform',
  'transform-origin',
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
]);

function fail(message) {
  throw new Error(message);
}

function read(relativePath) {
  return readFileSync(join(projectRoot, relativePath), 'utf8');
}

function checkJavaScript(source, label) {
  const directory = mkdtempSync(join(tmpdir(), 'aiui-validate-'));
  const path = join(directory, 'source.mjs');
  try {
    writeFileSync(path, source, 'utf8');
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  } catch (error) {
    const details = error.stderr?.toString().trim() || error.message;
    fail(`${label} JavaScript 语法错误：${details}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function walk(relativeDirectory) {
  const absoluteDirectory = join(projectRoot, relativeDirectory);
  if (!existsSync(absoluteDirectory)) return [];
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(relativeDirectory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

for (const file of requiredFiles) {
  if (!existsSync(join(projectRoot, file))) fail(`缺少必需文件：${file}`);
}

const appConfig = JSON.parse(read('app.json'));
if (!Array.isArray(appConfig.pages) || appConfig.pages.length === 0) {
  fail('app.json 必须声明至少一个页面');
}
if ('workers' in appConfig) fail('app.json 使用了已废弃的 workers 字段');

const appSource = read('app.js');
checkJavaScript(appSource, 'app.js');
if (!/export\s+default\s+\{/.test(appSource)) fail('app.js 必须使用 export default');

const inkSources = [];
for (const route of appConfig.pages) {
  const inkPath = `${route}.ink`;
  const multiFilePaths = ['json', 'wxml', 'wxss', 'js'].map((extension) => `${route}.${extension}`);
  const hasInk = existsSync(join(projectRoot, inkPath));
  const existingMultiFiles = multiFilePaths.filter((path) => existsSync(join(projectRoot, path)));
  if (hasInk && existingMultiFiles.length > 0) fail(`${route} 混用了 .ink 与多文件页面`);
  if (!hasInk && existingMultiFiles.length !== 4) fail(`${route} 没有完整的页面源文件`);
  if (hasInk) inkSources.push(inkPath);
}

for (const relativePath of inkSources) {
  const source = read(relativePath);
  const defMatch = source.match(/<script[^>]*\bdef\b[^>]*>([\s\S]*?)<\/script>/);
  const setupMatch = source.match(/<script\s+setup>([\s\S]*?)<\/script>/);
  const styleMatch = source.match(/<style>([\s\S]*?)<\/style>/);
  if (!defMatch || !setupMatch || !styleMatch) fail(`${relativePath} 缺少 def、setup 或 style 区块`);
  JSON.parse(defMatch[1]);
  checkJavaScript(setupMatch[1], `${relativePath} <script setup>`);
  if (!/export\s+default\s+\{/.test(setupMatch[1])) fail(`${relativePath} 必须使用 export default`);

  const pageRoots = (source.match(/<page(?:\s|>)/g) ?? []).length;
  const widgetRoots = (source.match(/<widget(?:\s|>)/g) ?? []).length;
  if (pageRoots + widgetRoots !== 1) fail(`${relativePath} 必须且只能有一个 page 或 widget 根`);

  const importPattern = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
  for (const match of setupMatch[1].matchAll(importPattern)) {
    const imported = resolve(projectRoot, dirname(relativePath), match[1]);
    if (!existsSync(imported)) fail(`${relativePath} 引用了不存在的模块：${match[1]}`);
  }

  const handlerPattern = /\b(?:bind|catch)[a-zA-Z]+="([a-zA-Z_$][\w$]*)"/g;
  for (const match of source.matchAll(handlerPattern)) {
    const handler = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`(?:^|\\n)\\s*${handler}\\s*\\(`).test(setupMatch[1])) {
      fail(`${relativePath} 的事件处理器 ${match[1]} 未定义`);
    }
  }

  const propertyPattern = /^\s*([\w-]+)\s*:/gm;
  for (const match of styleMatch[1].matchAll(propertyPattern)) {
    const property = match[1];
    if (!property.startsWith('--') && !supportedProperties.has(property)) {
      fail(`${relativePath} 使用了未确认的 WXSS 属性：${property}`);
    }
  }

  const forbiddenCopy = [/必须跟注/, /立即跟注/, /下注到\s*\d/, /加注到\s*\d/, /最佳行动\s*[:：]/];
  for (const pattern of forbiddenCopy) {
    if (pattern.test(source)) fail(`${relativePath} 包含禁止的实时行动文案：${pattern}`);
  }
}

for (const relativePath of ['app.js', ...walk('src').filter((path) => extname(path) === '.js')]) {
  const source = read(relativePath);
  checkJavaScript(source, relativePath);
  if (/\b(?:App|Page|Widget)\s*\(/.test(source)) {
    fail(`${relativePath} 使用了不支持的注册函数`);
  }
}

console.log('AIUI project validation passed.');
