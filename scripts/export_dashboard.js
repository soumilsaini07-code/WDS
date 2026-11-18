const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = 'C:/Users/Soumil/.gemini/antigravity-ide/scratch/wolf-of-dalal-street';
const destDir = 'C:/Users/Soumil/Downloads/Dalal-Street-Dashboard-Export';
const zipPath = 'C:/Users/Soumil/Downloads/Dalal-Street-Dashboard-Export.zip';

// Clean destination if exists
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

// Copy essential files and folders
const entriesToCopy = [
  'src',
  'public',
  'data',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'next.config.ts',
  'postcss.config.mjs'
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      if (child === 'node_modules' || child === '.next' || child === '.git') continue;
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

for (const entry of entriesToCopy) {
  const fullSrc = path.join(srcDir, entry);
  if (fs.existsSync(fullSrc)) {
    copyRecursive(fullSrc, path.join(destDir, entry));
  }
}

// Write README.md
const readme = [
  '# Dalal Street Live Trading Dashboard',
  '',
  'This package contains the complete standalone web application for the **Wolf of Dalal Street Live Trading Dashboard**.',
  '',
  '---',
  '',
  '## Quick Setup & Run Instructions',
  '',
  '### 1. Prerequisites',
  '- **Node.js**: Install Node.js v18.17+ or v20+ from https://nodejs.org/',
  '',
  '### 2. Install Dependencies',
  'Open terminal / cmd in this directory and run:',
  '```bash',
  'npm install',
  '```',
  '',
  '### 3. Run Development Server',
  '```bash',
  'npm run dev',
  '```',
  '',
  '### 4. Open Dashboard in Browser',
  '- **Dashboard URL**: http://localhost:3000/dashboard',
  '- Real-time order book, live tickers, interactive TradingView charts, and breaking news broadcast ticker are all active.',
  ''
].join('\n');

fs.writeFileSync(path.join(destDir, 'README.md'), readme, 'utf8');

console.log('Successfully copied all dashboard files to:', destDir);

// Compress to ZIP
try {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`powershell Compress-Archive -Path "${destDir}\\*" -DestinationPath "${zipPath}" -Force`);
  const zipSize = fs.statSync(zipPath).size;
  console.log('Created ZIP archive:', zipPath, 'Size:', (zipSize / 1024 / 1024).toFixed(2), 'MB');
} catch (err) {
  console.error('Failed to create ZIP archive:', err.message);
}
