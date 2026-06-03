/* eslint-disable no-console */
// Renders the social-card image used in <meta property="og:image">.
// Run: node --experimental-strip-types scripts/generate-og-image.ts
import path from 'path'
import { fileURLToPath } from 'url'

import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const websiteRoot = path.resolve(__dirname, '..')
const outPath = path.join(websiteRoot, 'static', 'img', 'jbrowse-og.png')

const WIDTH = 1200
const HEIGHT = 630
const NAVY = '#0d223f'
const TEAL = '#46cbae'

// the grayscale logo paths (viewBox 0 0 206 214) read well on the navy card
const logo = `<g transform="translate(150,205) scale(1.03)">
  <path fill="#e6e6e6" d="M146.668,87.223c.308.133.6.283.908.42l6.746-15.618c-.153-.067-.3-.143-.454-.21a81.36,81.36,0,0,0-71.777,3.5q-2.8,1.544-5.469,3.309l9.249,14.054A63.93,63.93,0,0,1,146.668,87.223Z"/>
  <path fill="#ffffff" d="M118.5,58.5c.168,0,.333.012.5.013V41.506c-.167,0-.333-.006-.5-.006a98.325,98.325,0,0,0-77.4,37.565q-2.664,3.378-5.023,6.994l14.206,9.327Q52.043,92.709,54,90.179A81.363,81.363,0,0,1,118.5,58.5Z"/>
  <path fill="#b3b3b3" d="M148.921,151.314c.04.163.07.326.107.489l16.509-4.058c-.039-.163-.067-.326-.107-.489A48.457,48.457,0,0,0,133.575,112.8l-5.515,15.591A32.466,32.466,0,0,1,148.921,151.314Z"/>
  <path fill="#cccccc" d="M168.894,110.37A63.929,63.929,0,0,0,111.4,89.861l2.336,15.474a48.456,48.456,0,0,1,44.322,15.42c.111.125.214.255.324.381l11.16-10C169.323,110.879,169.118,110.62,168.894,110.37Z"/>
  <path fill="#999999" d="M132.1,139.129l-9.779,13.213a32.486,32.486,0,0,1,7.823,14.463l15.147.852c.012-.166.032-.331.041-.5A32.464,32.464,0,0,0,132.1,139.129Z"/>
</g>`

const fontStack = 'Roboto, Helvetica, Arial, sans-serif'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>
  <rect x="0" y="${HEIGHT - 10}" width="${WIDTH}" height="10" fill="${TEAL}"/>
  ${logo}
  <text x="430" y="285" font-family="${fontStack}" font-size="120" font-weight="700" fill="#ffffff">JBrowse 2</text>
  <text x="434" y="355" font-family="${fontStack}" font-size="44" font-weight="400" fill="${TEAL}">The next-generation genome browser</text>
  <text x="434" y="415" font-family="${fontStack}" font-size="30" font-weight="400" fill="#9fb3c8">Web · Desktop · Embedded components</text>
  <text x="434" y="500" font-family="${fontStack}" font-size="28" font-weight="500" fill="#ffffff">jbrowse.org</text>
</svg>`

await sharp(new TextEncoder().encode(svg)).png().toFile(outPath)
console.log(`wrote ${path.relative(websiteRoot, outPath)}`)
