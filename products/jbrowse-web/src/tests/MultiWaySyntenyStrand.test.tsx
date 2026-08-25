import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { renderToString } from 'react-dom/server'

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
function ribbons(svg: string) {
  return [
    ...svg.matchAll(
      /M (-?[\d.]+) (-?[\d.]+) L (-?[\d.]+) (-?[\d.]+) L (-?[\d.]+) [\d.-]+ L (-?[\d.]+) [\d.-]+ Z/g,
    ),
  ].map(m => {
    const [x1, y1, x2, y2, x3, x4] = m.slice(1).map(Number) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    return {
      y1,
      y2,
      crossed: Math.sign(x4 - x1) !== Math.sign(x3 - x2),
    }
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

  const drawn = ribbons(renderToString(<>{await display.renderSvg()}</>))
  // one group ribbon from the anchor lane down, and the link ribbon between
  // the two mate lanes — which sits lower, and is the only reverse record
  expect(drawn.length).toBeGreaterThanOrEqual(2)
  const deepest = drawn.reduce((a, b) => (b.y1 > a.y1 ? b : a))
  expect(deepest.crossed).toBe(true)
  expect(
    drawn.filter(r => r.y1 < deepest.y1).map(r => r.crossed),
  ).not.toContain(true)
}, 60000)
