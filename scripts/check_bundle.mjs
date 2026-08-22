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

let initialTotalBytes = 0;
let initialTotalGzipBytes = 0;

for (const file of jsFiles) {
  const filePath = path.join(assetsDir, file);
  const content = fs.readFileSync(filePath);
  const rawBytes = content.length;
  const gzipBytes = zlib.gzipSync(content).length;

  const rawKb = (rawBytes / 1024).toFixed(2);
  const gzipKb = (gzipBytes / 1024).toFixed(2);

  const search = file.toLowerCase();
  const isLazy =
    search.includes('practicepage') ||
    search.includes('storiespage') ||
    search.includes('chatpage') ||
    search.includes('profilepage') ||
    search.includes('licensespage') ||
    search.includes('strokeorderpractice') ||
    search.includes('vendor-hanzi');

  console.log(
    `  ${isLazy ? '[LAZY]   ' : '[INITIAL]'} ${file.padEnd(35)} : ${rawKb.padStart(7)} KB raw | ${gzipKb.padStart(6)} KB gzip`
  );

  if (!isLazy) {
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
