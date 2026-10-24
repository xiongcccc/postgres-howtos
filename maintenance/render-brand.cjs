// Raster fallbacks are exports of the editable SVGs, not alternative logos.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const directory = path.join(__dirname,'../images/brand');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const assets = [];
  try {
    for (const [source,output,width,height,background] of [
      ['symbol.svg','favicon-32.png',32,32,'transparent'],
      ['symbol.svg','touch-180.png',180,180,'#ffffff'],
      ['social.svg','social.png',1200,630,'#ffffff']
    ]) {
      const svg = fs.readFileSync(path.join(directory,source),'utf8');
      const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
      await page.setContent('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:'+background+'}svg{display:block;width:100%;height:100%}</style>'+svg);
      await page.evaluate(() => document.fonts.ready);
      const bytes = await page.screenshot({omitBackground:background==='transparent'});
      fs.writeFileSync(path.join(directory,output),bytes);
      assets.push({source,output,width,height,sourceSha256:sha(svg),sha256:sha(bytes)});
      await page.close();
    }
    fs.writeFileSync(path.join(directory,'raster-manifest.json'),JSON.stringify({renderer:'Independent Chrome via Playwright; rerun when source SVGs change',assets},null,2)+'\n');
    console.log('Exported favicon, touch icon and 1200x630 social preview from SVG sources');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
