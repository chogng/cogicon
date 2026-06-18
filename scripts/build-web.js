import fs from 'fs';
import path from 'path';

const srcDir = './src/icons';
const mappingFile = './src/mapping.json';
const outFile = './icons.json';

const rawMapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
const iconSet = new Set(
  fs.readdirSync(srcDir)
    .filter(file => file.endsWith('.svg'))
    .map(file => path.basename(file, '.svg'))
);
const iconMeta = new Map();

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

const normalizedEntries = resolveAliases(
  Object.entries(rawMapping)
    .map(([codepoint, rawEntry]) => {
      const entry = normalizeEntry(rawEntry);

      if (!entry.name) {
        return null;
      }

      return {
        codepoint,
        ...entry
      };
    })
    .filter(Boolean)
);

for (const entry of normalizedEntries) {
  for (const term of [entry.name, ...entry.aliases]) {
    iconMeta.set(term, {
      codepoint: entry.codepoint,
      name: entry.name,
      aliases: entry.aliases,
      keywords: entry.keywords
    });
  }
}

const icons = fs
  .readdirSync(srcDir)
  .filter(file => file.endsWith('.svg'))
  .sort()
  .map(file => {
    const name = path.basename(file, '.svg');
    const meta = iconMeta.get(name);

    return {
      name,
      file: `./src/icons/${file}`,
      codepoint: meta?.codepoint ?? null,
      name: meta?.name ?? name,
      aliases: meta?.aliases ?? [],
      keywords: meta?.keywords ?? []
    };
  })
  .sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return (left.codepoint ?? 0) - (right.codepoint ?? 0);
  });

fs.writeFileSync(outFile, JSON.stringify({ icons }, null, 2));
console.log(`Generated ${outFile} with ${icons.length} icons.`);
