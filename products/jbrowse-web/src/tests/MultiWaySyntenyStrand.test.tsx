import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import baseConfig from '../../test_data/multiway_blocks/config.json' with { type: 'json' }
import { utilizeFetchMockForTest } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

import type { MultiWaySyntenyDisplayModel } from '@jbrowse/plugin-linear-comparative-view'
import type { GenericFilehandle } from 'generic-filehandle2'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

function multiwayGetFile(url: string): GenericFilehandle {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/multiway_blocks/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

utilizeFetchMockForTest(multiwayGetFile)

// grape/peach and grape/cacao run forward; peach/cacao — the ADJACENT mate-lane
// pair, whose ribbon comes from the per-pair link fetch rather than from the
// ortholog groups — runs reverse. Nothing else in the tree carries a reverse
// record for this display: the MCScan blocks format has no strand to invert and
// volvox_all_vs_all.paf is three `+` rows.
function reversePafConfig() {
  const config = JSON.parse(JSON.stringify(baseConfig)) as {
    assemblies: unknown[]
    tracks: unknown[]
  }
  config.tracks.push({
    type: 'SyntenyTrack',
    trackId: 'three_way_rev',
    name: 'grape/peach/cacao all-vs-all',
    assemblyNames: ['grape', 'peach', 'cacao'],
    adapter: {
      type: 'AllVsAllPAFAdapter',
      assemblyNames: ['grape', 'peach', 'cacao'],
      pafLocation: {
        uri: 'three_way_rev.paf',
        locationType: 'UriLocation',
      },
    },
    displays: [
      {
        type: 'MultiWaySyntenyDisplay',
        displayId: 'three_way_rev-MultiWaySyntenyDisplay',
      },
    ],
  })
  return config
}

// `ribbonPath` writes a parallelogram as `M x1 y1 L x2 y2 L x3 y2 L x4 y1 Z`:
// the upper edge runs x1..x4 and the lower edge x2..x3, with the sides joining
// x1-x2 and x4-x3. The two edges running opposite ways is the ribbon crossing.
// The ribbon corners as the synteny passes read them, per gutter: `bp1`→`bp4`
// is one edge and `bp2`→`bp3` the other, so a ribbon is crossed when its two
// edges run opposite ways.
function ribbons(display: MultiWaySyntenyDisplayModel) {
  const { cells, layers } = display.ribbonGeometry
  return layers.flatMap(layer => {
    const data = cells.get(layer.key)!
    return Array.from({ length: data.instanceCount }, (_, i) => {
      const xs = [data.bp1[i]!, data.bp4[i]!, data.bp3[i]!, data.bp2[i]!]
      return {
        y1: layer.yTop,
        y2: layer.yTop + layer.height,
        xs,
        crossed: Math.sign(xs[3]! - xs[0]!) !== Math.sign(xs[2]! - xs[1]!),
      }
    })
  })
}

test('a reverse-strand link between two mate lanes draws a crossed ribbon', async () => {
  const { rootModel } = getPluginManager(reversePafConfig())
  rootModel.setDefaultSession()
  const view = rootModel.session!.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: [
        {
          trackId: 'three_way_rev',
          type: 'MultiWaySyntenyDisplay',
          rowOrder: ['peach', 'cacao'],
        },
      ],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.groups.length).toBe(2)
      return d!
    },
    { timeout: 30000 },
  )
  expect(display.rowAssemblies).toEqual(['peach', 'cacao'])

  await waitFor(
    () => {
      expect(display.laneLinks?.get('peach|cacao')?.length).toBeGreaterThan(0)
    },
    { timeout: 30000 },
  )
  expect(display.laneLinks!.get('peach|cacao')![0]!.get('strand')).toBe(-1)

  const drawn = ribbons(display)
  // one group ribbon from the anchor lane down, and the link ribbon between
  // the two mate lanes — which sits lower, and is the only reverse record
  expect(drawn.length).toBeGreaterThanOrEqual(2)
  const deepest = drawn.reduce((a, b) => (b.y1 > a.y1 ? b : a))
  expect(deepest.crossed).toBe(true)
  expect(
    drawn.filter(r => r.y1 < deepest.y1).map(r => r.crossed),
  ).not.toContain(true)
}, 60000)

// A bp the lane's frame does not reach maps through `rowFrameX`, which
// extrapolates. The fourth row here runs Pp1:0-1100, straddling the edge of a
// frame that starts around Pp1:625 — a record an intersection test passes and
// the lane still cannot draw whole. Unclipped it put an endpoint 716 px off the
// left of the canvas, where the svg clips the rect it belongs to and the ribbon
// sweeps the page.
function farPafConfig() {
  const config = reversePafConfig()
  config.tracks.push({
    type: 'SyntenyTrack',
    trackId: 'three_way_far',
    name: 'grape/peach/cacao with an off-frame pair record',
    assemblyNames: ['grape', 'peach', 'cacao'],
    adapter: {
      type: 'AllVsAllPAFAdapter',
      assemblyNames: ['grape', 'peach', 'cacao'],
      pafLocation: {
        uri: 'three_way_far.paf',
        locationType: 'UriLocation',
      },
    },
    displays: [
      {
        type: 'MultiWaySyntenyDisplay',
        displayId: 'three_way_far-MultiWaySyntenyDisplay',
      },
    ],
  })
  return config
}

test('a link record outside a lane frame draws no ribbon off the canvas', async () => {
  const { rootModel } = getPluginManager(farPafConfig())
  rootModel.setDefaultSession()
  const view = rootModel.session!.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: [
        {
          trackId: 'three_way_far',
          type: 'MultiWaySyntenyDisplay',
          rowOrder: ['peach', 'cacao'],
        },
      ],
    },
  })
  const width = 800
  view.setWidth(width)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.rowFrames.get('peach')).toBeDefined()
      return d!
    },
    { timeout: 30000 },
  )

  // both peach/cacao records come back — the fetch window reaches the far one
  await waitFor(
    () => {
      expect(display.laneLinks?.get('peach|cacao')?.length).toBe(2)
    },
    { timeout: 30000 },
  )
  // and it STRADDLES the frame's edge, which is the case a bare intersection
  // test lets through
  const frame = display.rowFrames.get('peach')!
  const far = display
    .laneLinks!.get('peach|cacao')!
    .find(f => f.get('end') - f.get('start') === 1100)!
  expect(far.get('start')).toBeLessThan(frame.min)
  expect(far.get('end')).toBeGreaterThan(frame.min)

  const drawn = ribbons(display)
  expect(drawn.length).toBeGreaterThan(0)
  for (const { xs } of drawn) {
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(width)
    }
  }
}, 60000)

// `groupSpansOnRow` hands back the end corresponding to the anchor's START
// first, and `ribbonPath` joins first end to first end. `anchorSpans` sorted
// its pair ascending instead, so a horizontally flipped view — where the
// anchor's start draws to the RIGHT of its end, and the lane below mirrors to
// follow — paired every ortholog crosswise. A flip is a mirror: it may move
// where a ribbon is drawn, never whether it twists.
test('flipping the view horizontally does not twist the ribbons', async () => {
  const { rootModel } = getPluginManager(structuredClone(baseConfig))
  rootModel.setDefaultSession()
  const view = rootModel.session!.addView('LinearGenomeView', {
    init: {
      assembly: 'grape',
      loc: 'chr1:1-1000',
      tracks: [
        {
          trackId: 'multiway_blocks',
          type: 'MultiWaySyntenyDisplay',
          rowOrder: ['peach', 'cacao'],
        },
      ],
    },
  })
  view.setWidth(800)

  const display = await waitFor(
    () => {
      const d = view.tracks[0]?.displays[0] as
        | MultiWaySyntenyDisplayModel
        | undefined
      expect(d?.rowFrames.get('peach')?.flipped).toBe(false)
      return d!
    },
    { timeout: 30000 },
  )

  const twists = async () => {
    const drawn = ribbons(display)
    const top = Math.min(...drawn.map(r => r.y1))
    return drawn
      .filter(r => r.y1 === top)
      .map(r => r.crossed)
      .sort()
  }
  const before = await twists()
  expect(before.length).toBeGreaterThan(1)

  view.horizontallyFlip()
  // the lane below follows the anchor's new reading direction, which is what
  // makes this the case that used to invert
  expect(display.rowFrames.get('peach')!.flipped).toBe(true)
  expect(await twists()).toEqual(before)
}, 60000)
