import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../data/volvox')
const volvoxFasta = path.join(dataDir, 'volvox.fa')
const bam = path.join(dataDir, 'volvox-sorted.bam')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

// One `--loc` per panel. The `argv` entries are what parseArgv would produce;
// breakpointLocs reads them rather than `opts.loc` because standardizeArgv keeps
// only the last flag's first value.
function locArgv(...locs) {
  return locs.map(loc => ['loc', [loc]])
}

test('stacks one panel per --loc, each with the shared track', async () => {
  const svg = await renderRegion({
    mode: 'breakpoint',
    fasta: volvoxFasta,
    trackList: [['bam', [bam]]],
    argv: [...locArgv('ctgA:1-20000', 'ctgB:1-6000')],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  // Each panel draws its own region label, so both contigs naming themselves is
  // the evidence that two views rendered rather than one.
  assert.ok(svg.includes('ctgA'), 'first panel should render ctgA')
  assert.ok(svg.includes('ctgB'), 'second panel should render ctgB')
  // The track body is rasterized into an <image>; one per panel means the
  // shared track really did attach to both, which is what the connecting
  // ribbons are drawn across.
  const images = svg.match(/<image/g) ?? []
  assert.ok(
    images.length >= 2,
    `expected a rendered track body per panel, got ${images.length}`,
  )
})

test('takes as many panels as it is given', async () => {
  const svg = await renderRegion({
    mode: 'breakpoint',
    fasta: volvoxFasta,
    trackList: [['bam', [bam]]],
    argv: [...locArgv('ctgA:1-10000', 'ctgB:1-3000', 'ctgA:20000-30000')],
  })
  const images = svg.match(/<image/g) ?? []
  assert.ok(images.length >= 3, `expected 3 panels, got ${images.length}`)
})

// A space inside ONE --loc is a second window of that panel, not a second
// panel — the meaning it already has for a LinearGenomeView. Two panels, the
// first discontinuous.
test('whitespace inside one --loc adds a window to that panel', async () => {
  const svg = await renderRegion({
    mode: 'breakpoint',
    fasta: volvoxFasta,
    trackList: [['bam', [bam]]],
    argv: [...locArgv('ctgA:1-10000 ctgA:20000-30000', 'ctgB:1-3000')],
  })
  const images = svg.match(/<image/g) ?? []
  assert.equal(
    images.length,
    2,
    'two panels, so two track bodies — not three from splitting the first',
  )
})

test('refuses a single panel and names the repeat-the-flag fix', async () => {
  await assert.rejects(
    renderRegion({
      mode: 'breakpoint',
      fasta: volvoxFasta,
      trackList: [['bam', [bam]]],
      argv: [...locArgv('ctgA:1-20000 ctgB:1-6000')],
    }),
    /at least two/,
  )
})
