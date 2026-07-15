import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// Offline coverage of the --hub/--track wiring: a local config fixture exercises
// the same readData -> renderLinear -> resolveTrackId/configTrackCategory path
// that a fetched --hub config drives, without touching the network. (The Trix
// gene-name search path needs a hosted index, so it's verified manually.)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const config = path.join(__dirname, '../data/volvox-hub.config.json')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

test('--track shows a trackId from the config', async () => {
  const svg = await renderRegion({
    config,
    loc: 'ctgA:1-50000',
    showTracks: [['track', ['volvox-genes']]],
  })
  assert.ok(svg.includes('<svg'), 'output should be SVG')
  assert.ok(svg.includes('Volvox genes'), 'the feature track should be shown')
})

test('--track fills in the assembly-name prefix (genes -> volvox-genes)', async () => {
  const svg = await renderRegion({
    config,
    loc: 'ctgA:1-50000',
    showTracks: [['track', ['genes']]],
  })
  assert.ok(svg.includes('Volvox genes'), 'the shorthand should resolve')
})

test('--track routes a QuantitativeTrack to a wiggle display', async () => {
  const svg = await renderRegion({
    config,
    loc: 'ctgA:1-50000',
    showTracks: [['track', ['coverage', 'height:200']]],
  })
  assert.ok(svg.includes('Volvox coverage'), 'the wiggle track should be shown')
})

test('an unknown --track rejects with a not-found error', async () => {
  await assert.rejects(
    renderRegion({
      config,
      loc: 'ctgA:1-50000',
      showTracks: [['track', ['nonexistent']]],
    }),
    /not found in the config/,
  )
})
