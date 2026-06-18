import fs from 'fs';
import path from 'path';

const iconsDir = './src/icons';
const mappingFile = './src/mapping.json';
const startingCodepoint = 60000;

const iconNames = fs
  .readdirSync(iconsDir)
  .filter(file => file.endsWith('.svg'))
  .map(file => path.basename(file, '.svg'))
  .sort();

const iconSet = new Set(iconNames);
const existingMapping = fs.existsSync(mappingFile)
  ? JSON.parse(fs.readFileSync(mappingFile, 'utf8'))
  : {};

const entries = [];
const usedAliases = new Map();
const mappedIcons = new Set();

for (const [codepoint, rawAliases] of Object.entries(existingMapping)) {
  const normalizedAliases = Array.from(
    new Set(
      (Array.isArray(rawAliases) ? rawAliases : [])
        .filter(alias => typeof alias === 'string')
        .map(alias => alias.trim())
        .filter(Boolean)
    )
  );

  const iconName = normalizedAliases.find(alias => iconSet.has(alias));
  if (!iconName) {
    continue;
  }

  const aliases = [iconName, ...normalizedAliases.filter(alias => alias !== iconName)];
  if (mappedIcons.has(iconName)) {
    throw new Error(`Duplicate mapping entry for icon "${iconName}".`);
  }

  for (const alias of aliases) {
    const owner = usedAliases.get(alias);
    if (owner && owner !== codepoint) {
      throw new Error(`Alias "${alias}" is used by multiple codepoints.`);
    }
    usedAliases.set(alias, codepoint);
  }

  mappedIcons.add(iconName);
  entries.push({ codepoint: Number(codepoint), aliases });
}

let nextCodepoint = entries.reduce(
  (max, entry) => Math.max(max, entry.codepoint),
  startingCodepoint - 1
);

for (const iconName of iconNames) {
  if (mappedIcons.has(iconName)) {
    continue;
  }

  nextCodepoint += 1;
  entries.push({
    codepoint: nextCodepoint,
    aliases: [iconName]
  });
}

entries.sort((left, right) => left.codepoint - right.codepoint);

const syncedMapping = Object.fromEntries(
  entries.map(entry => [String(entry.codepoint), entry.aliases])
);

fs.writeFileSync(mappingFile, JSON.stringify(syncedMapping, null, 2) + '\n');
console.log(`Synced ${mappingFile} with ${iconNames.length} icons.`);
