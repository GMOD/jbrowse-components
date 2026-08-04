import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvox = path.join(__dirname, '../data/volvox')
const volvoxConfig = path.join(volvox, 'config.json')

const { setupEnv, renderRegion } = await import('../src/index.ts')
setupEnv()

// A LinearGenomeView snapshot over the bundled volvox config's SV track, so the
// session shapes below differ only in how that one view is wrapped.
const view = {
  id: 'testView',
  type: 'LinearGenomeView',
  bpPerPx: 20,
  offsetPx: 0,
  displayedRegions: [
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
  ],
  tracks: [
    {
      id: 'testTrack',
      type: 'VariantTrack',
      configuration: 'volvox_sv',
      displays: [
        {
          id: 'testDisplay',
          type: 'LinearVariantDisplay',
          configuration: 'volvox_sv-LinearVariantDisplay',
        },
      ],
    },
  ],
}

function sessionFile(session) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jbimg-session-'))
  const file = path.join(dir, 'session.json')
  fs.writeFileSync(file, JSON.stringify(session))
  return file
}

const render = session =>
  renderRegion({
    config: volvoxConfig,
    assembly: 'volvox',
    session: sessionFile(session),
    noRasterize: true,
  })

// The shape File -> Export session writes in jbrowse-web.
test('an exported session renders its view', async () => {
  const svg = await render({ session: { name: 'test', views: [view] } })
  assert.match(svg, /<svg/, 'output should be SVG')
})

// A session saved against the LGV-only react2 host, which jb2export used before
// react-app2, holds one `view` instead of a `views` array. react-app2's session
// model drops that unknown key, so the whole export came out as an empty ~500
// byte ruler with nothing reported.
test('a legacy singular-view session renders the same view', async () => {
  const legacy = await render({ name: 'test', view })
  const modern = await render({ session: { name: 'test', views: [view] } })
  assert.match(legacy, /<svg/, 'output should be SVG')
  assert.equal(
    legacy.length,
    modern.length,
    'the two shapes describe the same view and should render identically',
  )
})

// Any other way a session can arrive with nothing to draw. Without --loc the
// session IS the region, so this used to write a blank image and exit 0.
test('a session with no usable view fails instead of rendering blank', async () => {
  await assert.rejects(
    render({ session: { name: 'test', views: [] } }),
    /no view positioned on a region/,
  )
  await assert.rejects(
    render({ session: { name: 'test' } }),
    /no view positioned on a region/,
  )
})
