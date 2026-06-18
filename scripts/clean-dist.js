import fs from 'fs';

const distDir = './dist';

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

fs.mkdirSync(distDir, { recursive: true });
console.log(`Cleaned ${distDir}.`);
