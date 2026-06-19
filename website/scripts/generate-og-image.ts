// Renders the social-card image used in <meta property="og:image">.
// Run: node --experimental-strip-types scripts/generate-og-image.ts
//
// The "JBrowse 2" wordmark is baked in as vector outlines (wordmark-path.ts)
// rather than live text: the librsvg renderer behind sharp ignores embedded
// @font-face fonts and falls back to a system font, so text would render in
// whatever sans the host happens to have (with an ugly descending capital J).
// Outlines render identically everywhere. Regenerate the outlines from Inter
// (SIL OFL) with, after `npm i -g fonttools` or a venv with fonttools:
//
//   python3 - <<'PY'
//   from fontTools.ttLib import TTFont
//   from fontTools.pens.svgPathPen import SVGPathPen
//   f=TTFont('Inter-Regular.ttf'); gs=f.getGlyphSet(); cmap=f.getBestCmap()
//   hmtx=f['hmtx']; x=0; parts=[]
//   for ch in 'JBrowse 2':
//       g=cmap[ord(ch)]; p=SVGPathPen(gs); gs[g].draw(p); d=p.getCommands()
//       if d: parts.append('<path transform="translate(%d 0)" d="%s"/>'%(x,d))
//       x+=hmtx[g][0]
//   print(f['head'].unitsPerEm, x, ''.join(parts))
//   PY
import path from 'path'
import { fileURLToPath } from 'url'

import sharp from 'sharp'

import {
  wordmarkAdvance,
  wordmarkPaths,
  wordmarkUnitsPerEm,
} from './wordmark-path.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const websiteRoot = path.resolve(__dirname, '..')
const outPath = path.join(websiteRoot, 'static', 'img', 'jbrowse-og.png')

const WIDTH = 1200
const HEIGHT = 630
const NAVY = '#0d223f'

const FONT_SIZE = 130
const scale = FONT_SIZE / wordmarkUnitsPerEm
const wordmarkPx = wordmarkAdvance * scale

const LOGO_SCALE = 0.89
const logoPx = 206 * LOGO_SCALE
const GAP = 40

// center the logo + wordmark as one unit
const groupX = (WIDTH - (logoPx + GAP + wordmarkPx)) / 2
const wordmarkX = groupX + logoPx + GAP
const baselineY = 363

// the grayscale logo paths (viewBox 0 0 206 214) read well on the navy card
const logo = `<g transform="translate(${groupX},220) scale(${LOGO_SCALE})">
  <path fill="#e6e6e6" d="M146.668,87.223c.308.133.6.283.908.42l6.746-15.618c-.153-.067-.3-.143-.454-.21a81.36,81.36,0,0,0-71.777,3.5q-2.8,1.544-5.469,3.309l9.249,14.054A63.93,63.93,0,0,1,146.668,87.223Z"/>
  <path fill="#ffffff" d="M118.5,58.5c.168,0,.333.012.5.013V41.506c-.167,0-.333-.006-.5-.006a98.325,98.325,0,0,0-77.4,37.565q-2.664,3.378-5.023,6.994l14.206,9.327Q52.043,92.709,54,90.179A81.363,81.363,0,0,1,118.5,58.5Z"/>
  <path fill="#b3b3b3" d="M148.921,151.314c.04.163.07.326.107.489l16.509-4.058c-.039-.163-.067-.326-.107-.489A48.457,48.457,0,0,0,133.575,112.8l-5.515,15.591A32.466,32.466,0,0,1,148.921,151.314Z"/>
  <path fill="#cccccc" d="M168.894,110.37A63.929,63.929,0,0,0,111.4,89.861l2.336,15.474a48.456,48.456,0,0,1,44.322,15.42c.111.125.214.255.324.381l11.16-10C169.323,110.879,169.118,110.62,168.894,110.37Z"/>
  <path fill="#999999" d="M132.1,139.129l-9.779,13.213a32.486,32.486,0,0,1,7.823,14.463l15.147.852c.012-.166.032-.331.041-.5A32.464,32.464,0,0,0,132.1,139.129Z"/>
</g>`

// wordmark outlines are font units, y-up — flip Y and scale into place
const wordmark = `<g transform="translate(${wordmarkX},${baselineY}) scale(${scale},${-scale})" fill="#ffffff">${wordmarkPaths}</g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>
  ${logo}
  ${wordmark}
</svg>`

await sharp(new TextEncoder().encode(svg)).png().toFile(outPath)
console.log(`wrote ${path.relative(websiteRoot, outPath)}`)
