/**
 * @jest-environment jsdom
 *
 * jsdom via the environment rather than via `setupEnv()`: that helper builds its
 * own JSDOM, and importing jsdom here drags in an ESM-only transitive dep that
 * jest would have to be told to transpile repo-wide. The environment supplies
 * the same globals renderToSvg wants, and the rest of what setupEnv does is
 * reproduced below.
 */
/**
 * A session may position its view either way: the old form spells out
 * `displayedRegions` (plus offsetPx/bpPerPx), the current one hands the view an
 * `init` blob and lets its autorun navigate. Only the first used to work here —
 * the LGV was the one view type this tool adopts from the session rather than
 * builds, and the wait for `init` lived in the construct path, so the
 * positioned-on-a-region check ran before navigation had happened and the
 * render failed with "has no view positioned on a region".
 *
 * Both forms are rendered here against the same local volvox data so the pair
 * can't drift apart again.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { enableStaticRendering } from 'mobx-react'

import { renderRegion } from './renderRegion.tsx'

// The half of setupEnv() the jsdom environment doesn't cover. Static rendering
// is the load-bearing one: these renders go to static markup, so an observer
// that subscribed would fire its reaction after destroy() and read a dead MST
// node.
enableStaticRendering(true)

const configFile = path.join(__dirname, '..', 'data', 'volvox', 'config.json')

function writeSession(session: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-session-'))
  const file = path.join(dir, 'session.json')
  fs.writeFileSync(file, JSON.stringify({ session }))
  return file
}

const view = {
  id: 'testview',
  type: 'LinearGenomeView',
}

// Rasterizing needs the node canvas and says nothing about navigation, so these
// stay vector-only — the assertion is that the view got somewhere, not what the
// pixels look like.
const opts = { config: configFile, assembly: 'volvox', width: 800 }

test('renders a session whose view carries an init blob', async () => {
  const svg = await renderRegion({
    ...opts,
    noRasterize: true,
    session: writeSession({
      name: 'init form',
      views: [{ ...view, init: { assembly: 'volvox', loc: 'ctgA:1-4000' } }],
    }),
  })
  expect(svg).toContain('<svg')
  // the ruler labels the region it navigated to, so this fails on an empty view
  expect(svg).toContain('ctgA')
}, 60000)

test('renders a session whose view spells out displayedRegions', async () => {
  const svg = await renderRegion({
    ...opts,
    noRasterize: true,
    session: writeSession({
      name: 'explicit form',
      views: [
        {
          ...view,
          bpPerPx: 5,
          offsetPx: 0,
          displayedRegions: [
            {
              refName: 'ctgA',
              start: 0,
              end: 4000,
              reversed: false,
              assemblyName: 'volvox',
            },
          ],
        },
      ],
    }),
  })
  expect(svg).toContain('<svg')
  expect(svg).toContain('ctgA')
}, 60000)

test('still reports a session that positions no view at all', async () => {
  await expect(
    renderRegion({
      ...opts,
      noRasterize: true,
      session: writeSession({ name: 'nowhere', views: [view] }),
    }),
  ).rejects.toThrow(/no view positioned on a region/)
}, 60000)
