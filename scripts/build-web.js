import fs from 'fs';
import path from 'path';

const srcDir = './src/icons';
const mappingFile = './src/mapping.json';
const outFile = './icons.json';

const rawMapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
const iconMeta = new Map();

for (const [codepoint, aliases] of Object.entries(rawMapping)) {
  for (const alias of aliases) {
    iconMeta.set(alias, {
      codepoint,
      aliases
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
      aliases: meta?.aliases ?? [name]
    };
  });

fs.writeFileSync(outFile, JSON.stringify({ icons }, null, 2));
console.log(`Generated ${outFile} with ${icons.length} icons.`);
