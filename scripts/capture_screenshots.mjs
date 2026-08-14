import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DOCS_DIR = path.resolve(process.cwd(), 'docs');
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function getBrowserPath() {
  if (process.env.BROWSER_PATH && fs.existsSync(process.env.BROWSER_PATH)) {
    return process.env.BROWSER_PATH;
  }
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'google-chrome';
}

const browserBinary = getBrowserPath();

const PORT = 9333;
const TEMP_PROFILE = path.resolve(process.cwd(), '.tmp-browser-profile');
if (!fs.existsSync(TEMP_PROFILE)) {
  fs.mkdirSync(TEMP_PROFILE, { recursive: true });
}

console.log(`Starting headless browser from ${browserBinary} on debug port ${PORT}...`);
const browserProcess = spawn(browserBinary, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${TEMP_PROFILE}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1200,800',
  'about:blank',
]);

// Helper to wait
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getWebSocketUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch {
      await delay(500);
    }
  }
  throw new Error('Failed to connect to browser debugging port.');
}

async function run() {
  try {
    const wsUrl = await getWebSocketUrl();
    console.log('Connected to browser CDP:', wsUrl);

    // Get existing page target from /json/list
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const targets = await listRes.json();
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    if (!pageTarget) throw new Error('No page target found in browser.');
    const pageWsUrl = pageTarget.webSocketDebuggerUrl;

    const ws = new WebSocket(pageWsUrl);

    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        callbacks.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1200,
      height: 800,
      deviceScaleFactor: 2,
      mobile: false,
    });

    const routes = [
      { url: 'http://localhost:5173/', file: 'screenshot-learn.png', name: 'Learn Mode' },
      { url: 'http://localhost:5173/stories', file: 'screenshot-stories.png', name: 'Graded Stories' },
      { url: 'http://localhost:5173/practice', file: 'screenshot-practice.png', name: 'Daily Practice Hub' },
      { url: 'http://localhost:5173/chat', file: 'screenshot-chat.png', name: 'AI Language Buddy Chat' },
      { url: 'http://localhost:5173/profile', file: 'screenshot-profile.png', name: 'Scholar Profile & Stats' },
    ];

    for (const route of routes) {
      console.log(`Navigating to ${route.name} (${route.url})...`);
      await send('Page.navigate', { url: route.url });
      await delay(2000); // Allow fonts, animations, and data to hydrate

      const screenshotRes = await send('Page.captureScreenshot', {
        format: 'png',
        quality: 100,
      });

      const filePath = path.join(DOCS_DIR, route.file);
      fs.writeFileSync(filePath, Buffer.from(screenshotRes.data, 'base64'));
      console.log(`✓ Saved ${route.file}`);

      if (route.file === 'screenshot-learn.png') {
        // Also save as readme-preview.png hero banner
        const heroPath = path.join(DOCS_DIR, 'readme-preview.png');
        fs.writeFileSync(heroPath, Buffer.from(screenshotRes.data, 'base64'));
        console.log(`✓ Updated docs/readme-preview.png`);
      }
    }

    ws.close();
    console.log('All screenshots captured successfully!');
  } finally {
    browserProcess.kill();
    try {
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
