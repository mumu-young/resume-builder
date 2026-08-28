'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
function findBrowser(){
  for (const c of EDGE_CANDIDATES){ if (fs.existsSync(c)) return c; }
  throw new Error('no browser found');
}
function httpJson(url, method, body){
  method = method || 'GET';
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: body ? { 'Content-Type': 'application/json' } : undefined }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(d); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
class Cdp {
  constructor(wsUrl){
    this.ws = new WebSocket(wsUrl);
    this.seq = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => { this.ws.addEventListener('open', res); this.ws.addEventListener('error', rej); });
    this.ws.addEventListener('message', ev => this._onMsg(ev.data));
  }
  _onMsg(data){
    const m = JSON.parse(data);
    if (m.id){ const p = this.pending.get(m.id); if (p){ this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }
  }
  async open(){ await this.ready; }
  send(method, params){
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async eval(expression, awaitPromise){
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: !!awaitPromise });
    if (r.exceptionDetails){
      const d = r.exceptionDetails.exception;
      throw new Error('page exception: ' + ((d && (d.description || d.value)) || r.exceptionDetails.text));
    }
    return r.result ? r.result.value : undefined;
  }
  async navigate(url){
    await this.send('Page.enable');
    await this.send('Page.navigate', { url });
    await this.waitFor('document.readyState === "complete"');
  }
  async waitFor(expr, timeoutMs){
    timeoutMs = timeoutMs || 20000;
    const start = Date.now();
    for (;;){
      let v = false;
      try { v = await this.eval(expr); } catch (e) { /* ignore */ }
      if (v) return;
      if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout: ' + expr);
      await new Promise(r => setTimeout(r, 120));
    }
  }
  close(){ try { this.ws.close(); } catch (e) {} }
}
async function launchBrowser(){
  const browserPath = findBrowser();
  const port = 9400 + Math.floor(Math.random() * 400);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-app-'));
  const proc = spawn(browserPath, [
    '--headless', '--remote-debugging-port=' + port, '--user-data-dir=' + userData,
    '--no-first-run', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-allow-origins=*', 'about:blank'
  ], { stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const start = Date.now();
  for (;;){
    try { await httpJson(base + '/json/version'); break; }
    catch (e){
      if (Date.now() - start > 20000){ try { proc.kill(); } catch (e2) {} throw new Error('browser failed to start'); }
      await new Promise(r => setTimeout(r, 200));
    }
  }
  const list = await httpJson(base + '/json/list');
  const page = list.find(t => t.type === 'page');
  const cdp = new Cdp(page.webSocketDebuggerUrl);
  await cdp.open();
  return {
    proc, cdp, base, userData,
    fileUrl(p){ return pathToFileURL(path.resolve(p)).href; },
    async close(){
      try { cdp.close(); } catch (e) {}
      try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
      try { proc.kill(); } catch (e) {}
    }
  };
}
module.exports = { launchBrowser, findBrowser, httpJson };