import fs from 'fs';
import path from 'path';
import { optimize } from 'svgo';

const srcDir = './src/icons';
const genDir = './src-generated';

// 确保或清空临时生成的 TS 目录
if (fs.existsSync(genDir)) fs.rmSync(genDir, { recursive: true });
fs.mkdirSync(genDir);

// 读取 src 下所有的 svg
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.svg')).sort();
let indexContent = '';

files.forEach(file => {
  const name = path.basename(file, '.svg');
  const svgContent = fs.readFileSync(path.join(srcDir, file), 'utf-8');

  // 1. 用 SVGO 压缩 SVG，保留彩色（不转为 currentColor）
  const optimized = optimize(svgContent, {
    plugins: ['preset-default']
  });

  // 2. 将文件名转为小驼峰函数名（如 home-icon -> lxHomeIcon）
  const funcName = 'lx' + name.replace(/(^\w|-\w)/g, m => m.replace('-', '').toUpperCase());

  // 3. 生成独立的 ts 文件内容（导出一个返回 SVG 字符串的函数）
  const tsContent = `export const ${funcName} = (): string => \`${optimized.data}\`;\n`;
  fs.writeFileSync(path.join(genDir, `${name}.ts`), tsContent);

  // 4. 记录到总入口
  indexContent += `export { ${funcName} } from './${name}.js';\n`;
});

// 5. 额外写一个通用的渲染函数到总入口
indexContent += `
export function renderIcon(iconFunction: () => string, container: HTMLElement): SVGElement {
  const div = document.createElement('div');
  div.innerHTML = iconFunction().trim();
  const svgElement = div.firstElementChild as SVGElement;
  container.appendChild(svgElement);
  return svgElement;
}\n`;

// 6. 输出总入口 index.ts
fs.writeFileSync(path.join(genDir, 'index.ts'), indexContent);
console.log('🚀 SVG 成功转换为 TS 函数代码！');
