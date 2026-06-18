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

for (const [codepoint, rawEntry] of Object.entries(rawMapping)) {
  const entry = normalizeEntry(rawEntry);
  const iconName = entry.name;

  if (!iconName) {
    continue;
  }

  for (const term of [iconName, ...entry.aliases]) {
    iconMeta.set(term, {
      codepoint,
      name: iconName,
      aliases: entry.aliases,
      terms: entry.terms
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
      terms: meta?.terms ?? []
    };
  });

fs.writeFileSync(outFile, JSON.stringify({ icons }, null, 2));
console.log(`Generated ${outFile} with ${icons.length} icons.`);
