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
    const inheritedTerms = nameValues.filter(value => value !== name);

    return {
      name,
      aliases: aliases.filter(alias => alias !== name),
      keywords: normalizeStringList([
        ...inheritedTerms,
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

function serializeEntry(entry) {
  return {
    name: entry.name,
    ...(entry.aliases.length > 0 ? { aliases: entry.aliases } : {}),
    ...(entry.keywords.length > 0 ? { keywords: entry.keywords } : {})
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

const entries = [];
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

  mappedIcons.add(iconName);
  entries.push({
    codepoint: Number(codepoint),
    name: iconName,
    aliases,
    keywords: normalizedEntry.keywords
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
    keywords: []
  });
}

const resolvedEntries = resolveAliases(entries);

resolvedEntries.sort((left, right) => {
  const nameCompare = left.name.localeCompare(right.name);
  if (nameCompare !== 0) {
    return nameCompare;
  }

  return left.codepoint - right.codepoint;
});

const syncedMapping = Object.fromEntries(
  resolvedEntries.map(entry => [String(entry.codepoint), serializeEntry(entry)])
);

fs.writeFileSync(mappingFile, JSON.stringify(syncedMapping, null, 2) + '\n');
console.log(`Synced ${mappingFile} with ${iconNames.length} icons.`);
