import fs from 'fs';
import path from 'path';
import { optimize } from 'svgo';

const srcDir = './src/icons';
const genDir = './src-generated';
const mappingFile = './src/mapping.json';
const rawMapping = fs.existsSync(mappingFile)
  ? JSON.parse(fs.readFileSync(mappingFile, 'utf8'))
  : {};

if (fs.existsSync(genDir)) fs.rmSync(genDir, { recursive: true });
fs.mkdirSync(genDir);

const files = fs.readdirSync(srcDir).filter(file => file.endsWith('.svg')).sort();
const iconSet = new Set(files.map(file => path.basename(file, '.svg')));
let indexContent = '';

function normalizeStringList(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeEntry(rawEntry) {
  if (Array.isArray(rawEntry)) {
    const aliases = normalizeStringList(rawEntry);

    return {
      name: aliases[0] ?? '',
      aliases: aliases.slice(1),
      keywords: []
    };
  }

  if (rawEntry && typeof rawEntry === 'object') {
    const aliases = normalizeStringList(rawEntry.aliases);
    const nameValues = [
      ...(typeof rawEntry.name === 'string' ? [rawEntry.name.trim()] : normalizeStringList(rawEntry.name)),
      ...(typeof rawEntry.family === 'string' ? [rawEntry.family.trim()] : normalizeStringList(rawEntry.family))
    ].filter(Boolean);
    const explicitIconName = nameValues.find(value => iconSet.has(value)) ?? '';
    const aliasIconName = aliases.find(alias => iconSet.has(alias)) ?? '';
    const name = explicitIconName || aliasIconName || nameValues[0] || '';

    return {
      name,
      aliases: aliases.filter(alias => alias !== name),
      keywords: normalizeStringList([
        ...nameValues.filter(value => value !== name),
        ...normalizeStringList(rawEntry.keywords),
        ...normalizeStringList(rawEntry.terms)
      ])
    };
  }

  return {
    name: '',
    aliases: [],
    keywords: []
  };
}

function resolveAliases(entries) {
  const canonicalNames = new Set(entries.map(entry => entry.name));
  const aliasCounts = new Map();

  for (const entry of entries) {
    for (const alias of entry.aliases) {
      aliasCounts.set(alias, (aliasCounts.get(alias) ?? 0) + 1);
    }
  }

  return entries.map(entry => {
    const aliases = [];
    const keywords = [...entry.keywords];

    for (const alias of entry.aliases) {
      if (canonicalNames.has(alias) || (aliasCounts.get(alias) ?? 0) > 1) {
        keywords.push(alias);
      } else {
        aliases.push(alias);
      }
    }

    return {
      ...entry,
      aliases: normalizeStringList(aliases),
      keywords: normalizeStringList(keywords)
    };
  });
}

function toFunctionName(name) {
  return 'lx' + name.replace(/(^\w|-\w)/g, match => match.replace('-', '').toUpperCase());
}

const aliasEntries = resolveAliases(
  Object.values(rawMapping)
    .map(normalizeEntry)
    .filter(entry => entry.name && iconSet.has(entry.name))
);
const aliasExports = [];

for (const entry of aliasEntries) {
  for (const alias of entry.aliases) {
    if (iconSet.has(alias)) {
      continue;
    }

    aliasExports.push({
      aliasName: toFunctionName(alias),
      targetName: toFunctionName(entry.name),
      targetFile: entry.name
    });
  }
}

const aliasExportMap = new Map();
for (const aliasExport of aliasExports) {
  const existing = aliasExportMap.get(aliasExport.aliasName);

  if (existing && existing.targetName !== aliasExport.targetName) {
    throw new Error(`Duplicate alias export "${aliasExport.aliasName}".`);
  }

  aliasExportMap.set(aliasExport.aliasName, aliasExport);
}

files
  .slice()
  .sort((left, right) => path.basename(left, '.svg').localeCompare(path.basename(right, '.svg')))
  .forEach(file => {
  const name = path.basename(file, '.svg');
  const svgContent = fs.readFileSync(path.join(srcDir, file), 'utf-8');
  const optimized = optimize(svgContent, {
    plugins: ['preset-default']
  });
  const funcName = toFunctionName(name);
  const tsContent = `export const ${funcName} = (): string => \`${optimized.data}\`;\n`;

  fs.writeFileSync(path.join(genDir, `${name}.ts`), tsContent);
  indexContent += `export { ${funcName} } from './${name}.js';\n`;
});

for (const { aliasName, targetName, targetFile } of [...aliasExportMap.values()].sort((left, right) => left.aliasName.localeCompare(right.aliasName))) {
  indexContent += `export { ${targetName} as ${aliasName} } from './${targetFile}.js';\n`;
}

indexContent += `
export function renderIcon(iconFunction: () => string, container: HTMLElement): SVGElement {
  const div = document.createElement('div');
  div.innerHTML = iconFunction().trim();
  const svgElement = div.firstElementChild as SVGElement;
  container.appendChild(svgElement);
  return svgElement;
}\n`;

fs.writeFileSync(path.join(genDir, 'index.ts'), indexContent);
console.log('SVG converted to TypeScript icon functions.');
