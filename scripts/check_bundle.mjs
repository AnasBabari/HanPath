import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MAX_INITIAL_GZIP_KB = 130;
const MAX_INITIAL_GZIP_BYTES = MAX_INITIAL_GZIP_KB * 1024;

const distDir = path.resolve(process.cwd(), 'dist');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('dist/assets directory not found. Please run "npm run build" first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const jsFiles = files.filter((f) => f.endsWith('.js'));

console.log('HanPath Production Bundle Size Audit:');
console.log('--------------------------------------------------');

const indexPath = path.join(distDir, 'index.html');
const indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';

// Initial chunks are those directly loaded or preloaded by index.html for first paint
const initialChunkNames = new Set();
const assetMatches = indexHtml.matchAll(/(?:src|href)="(?:\/assets\/|assets\/)?([^"]+\.js)"/g);
for (const match of assetMatches) {
  const baseName = path.basename(match[1]);
  initialChunkNames.add(baseName);
}

let initialTotalBytes = 0;
let initialTotalGzipBytes = 0;

for (const file of jsFiles) {
  const filePath = path.join(assetsDir, file);
  const content = fs.readFileSync(filePath);
  const rawBytes = content.length;
  const gzipBytes = zlib.gzipSync(content).length;

  const rawKb = (rawBytes / 1024).toFixed(2);
  const gzipKb = (gzipBytes / 1024).toFixed(2);

  // If index.html is present, rely on actual entry module graph; otherwise fallback to heuristics
  const isInitial = initialChunkNames.size > 0 ? initialChunkNames.has(file) : !file.includes('Page') && !file.includes('stories') && !file.includes('sentences') && !file.includes('hanzi');

  console.log(
    `  ${!isInitial ? '[LAZY]   ' : '[INITIAL]'} ${file.padEnd(35)} : ${rawKb.padStart(7)} KB raw | ${gzipKb.padStart(6)} KB gzip`
  );

  if (isInitial) {
    initialTotalBytes += rawBytes;
    initialTotalGzipBytes += gzipBytes;
  }
}

console.log('--------------------------------------------------');
const totalInitialGzipKb = (initialTotalGzipBytes / 1024).toFixed(2);
console.log(
  `Total Initial Page-Load JS: ${(initialTotalBytes / 1024).toFixed(2)} KB raw | ${totalInitialGzipKb} KB gzip (Budget: <= ${MAX_INITIAL_GZIP_KB} KB gzip)`
);

if (initialTotalGzipBytes > MAX_INITIAL_GZIP_BYTES) {
  console.error(
    `\nBUDGET EXCEEDED: Initial JavaScript is ${totalInitialGzipKb} KB gzip, exceeding the ${MAX_INITIAL_GZIP_KB} KB limit.`
  );
  process.exit(1);
}

console.log('Bundle budget verified successfully!');
process.exit(0);
