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
      terms: []
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
    const inheritedTerms = nameValues.filter(value => value !== name);

    return {
      name,
      aliases: aliases.filter(alias => alias !== name),
      terms: normalizeStringList([...inheritedTerms, ...normalizeStringList(rawEntry.terms)])
    };
  }

  return {
    name: '',
    aliases: [],
    terms: []
  };
}

function serializeEntry(entry) {
  return {
    name: entry.name,
    ...(entry.aliases.length > 0 ? { aliases: entry.aliases } : {}),
    ...(entry.terms.length > 0 ? { terms: entry.terms } : {})
  };
}

const entries = [];
const usedAliases = new Map();
const mappedIcons = new Set();

for (const [codepoint, rawEntry] of Object.entries(existingMapping)) {
  const normalizedEntry = normalizeEntry(rawEntry);
  const iconName = normalizedEntry.name || normalizedEntry.aliases.find(alias => iconSet.has(alias));

  if (!iconName || !iconSet.has(iconName)) {
    continue;
  }

  const aliases = normalizedEntry.aliases.filter(alias => alias !== iconName);
  if (mappedIcons.has(iconName)) {
    throw new Error(`Duplicate mapping entry for icon "${iconName}".`);
  }

  for (const alias of [iconName, ...aliases]) {
    const owner = usedAliases.get(alias);
    if (owner && owner !== codepoint) {
      throw new Error(`Alias "${alias}" is used by multiple codepoints.`);
    }
    usedAliases.set(alias, codepoint);
  }

  mappedIcons.add(iconName);
  entries.push({
    codepoint: Number(codepoint),
    name: iconName,
    aliases,
    terms: normalizedEntry.terms
  });
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
    name: iconName,
    aliases: [],
    terms: []
  });
}

entries.sort((left, right) => left.codepoint - right.codepoint);

const syncedMapping = Object.fromEntries(
  entries.map(entry => [String(entry.codepoint), serializeEntry(entry)])
);

fs.writeFileSync(mappingFile, JSON.stringify(syncedMapping, null, 2) + '\n');
console.log(`Synced ${mappingFile} with ${iconNames.length} icons.`);
