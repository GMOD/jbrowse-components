const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  browser.on('targetcreated', async target => {
    if (target.url().includes('rpcWorker')) {
      const cdp = await target.createCDPSession();
      await cdp.send('Network.enable');
      const reqs = new Set();
      cdp.on('Network.requestWillBeSent', e => {
        if (e.request.url.includes('apollo')) {
          reqs.add(e.requestId);
          console.log('[worker net] requestWillBeSent', e.requestId, e.request.method, e.request.url);
        }
      });
      cdp.on('Network.responseReceived', e => {
        if (reqs.has(e.requestId)) {
          console.log('[worker net] responseReceived', e.requestId, e.response.status,
            'connectionReused:', e.response.connectionReused, JSON.stringify(e.response.headers));
        }
      });
      cdp.on('Network.loadingFinished', e => {
        if (reqs.has(e.requestId)) console.log('[worker net] loadingFinished', e.requestId, 'encodedDataLength', e.encodedDataLength);
      });
      cdp.on('Network.loadingFailed', e => {
        if (reqs.has(e.requestId)) console.log('[worker net] loadingFailed', e.requestId, e.errorText, JSON.stringify(e.corsErrorStatus));
      });
    }
  });

  page.on('console', msg => console.log('[console]', msg.type(), msg.text()));

  const url = 'http://localhost:3000/?config=http%3A%2F%2Flocalhost%3A9000%2Flocal.config.json&session=share-TyNlZCi8AS&password=0heJc';
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('goto error', e.message));

  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Yes, I trust it'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) { console.log('clicked at iter', i); break; }
  }

  await new Promise(r => setTimeout(r, 8000));
  await page.screenshot({ path: '/tmp/verify1.png' });
  console.log('DONE');
  await browser.close();
})();
