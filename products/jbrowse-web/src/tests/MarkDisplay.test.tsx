import './svgExportMocks.ts'

import { saveAs } from '@jbrowse/core/util'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  getSavedSvg,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

// One of the volvox config's own tracks, re-declared with a mark display: the
// track type and its adapter are the config's, and only the `displays` entry
// is this suite's. `over` is which track — the BED12 FeatureTrack by default,
// the BAM and the VCF for the pileup and the variant strip.
function markTrackConfig(
  trackId: string,
  marks: unknown[],
  over = 'bedtabix_genes',
) {
  const base = volvoxConfigWithTracks([over])
  return {
    ...base,
    tracks: base.tracks.map(t => ({
      ...t,
      trackId,
      name: trackId,
      displays: [
        { type: 'LinearMarkDisplay', displayId: `${trackId}-marks`, marks },
      ],
    })),
  }
}

interface MarkDisplayProbe {
  rowCount: number
  domain?: [number, number]
  independentValueScale?: { domain: [number, number]; field: string }
  axes: { side?: string }[]
  rpcDataMap: ReadonlyMap<
    number,
    {
      layers: {
        count: number
        x: Uint32Array
        x2: Uint32Array
        row?: Uint32Array
        y?: Float32Array
      }[]
    }
  >
}

function probe(view: { tracks: { displays: unknown[] }[] }) {
  return view.tracks[0]!.displays[0] as MarkDisplayProbe
}

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const timeout = 20000

test('bars from a BED score column, coloured by strand, with the key on screen', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_bars', [
      {
        shape: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'strand', scale: 'categorical' },
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_bars'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayId).toBe('mark_bars-marks')
  // every feature in volvox-bed12 is on the + strand, so the categorical
  // table the worker resolved has the one entry
  const legend = await findByTestId('floating-legend', {}, { timeout })
  await waitFor(() => {
    expect(legend.textContent).toContain('1')
  })
}, 30000)

test('the SVG export paints the same bars and carries the key', async () => {
  const { view, findByTestId, findByText } = await createView(
    markTrackConfig('mark_bars', [
      {
        shape: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'strand', scale: 'categorical', palette: ['red'] },
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_bars'), {}, { timeout }))
  await findDisplayPainted('mark-display', { timeout })

  fireEvent.click(await findByTestId('view_menu_icon', {}, { timeout }))
  fireEvent.click(await findByText('Export SVG', {}, { timeout }))
  fireEvent.click(await findByText('Submit', {}, { timeout }))
  await waitFor(
    () => {
      expect(saveAs).toHaveBeenCalled()
    },
    { timeout },
  )
  const svg = getSavedSvg()
  // the painter's bars: score 1000 tops the domain, so each is the full plot height, in the palette colour the worker packed
  expect(svg).toContain('height="140" fill="rgb(255,0,0)"')
  // the key, off the same table
  expect(svg).toContain('data-testid="color-legend"')
  expect(svg).toContain('>1<')
}, 40000)

test('points over the same file with a jexl colour', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_points', [
      {
        shape: 'point',
        encoding: {
          y: 'score',
          color: "jexl:get(feature,'name')=='EDEN.1'?'red':'blue'",
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_points'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayId).toBe('mark_points-marks')
  expect(el.dataset.displayDrawn).toBe('true')
}, 30000)

test('points with the glyph a scale over a field, and the key drawing each glyph', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_glyphs', [
      {
        shape: 'point',
        encoding: {
          y: 'score',
          glyph: {
            field: 'name',
            scale: 'categorical',
            domain: ['EDEN.1', 'EDEN.2'],
            range: ['triangle', 'diamond'],
          },
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_glyphs'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayDrawn).toBe('true')
  // the pinned domain's rows lead the key and the region's other name
  // follows, walking the range again; every swatch is the glyph itself
  const legend = await findByTestId('floating-legend', {}, { timeout })
  await waitFor(() => {
    expect(legend.textContent).toContain('EDEN.3')
  })
  expect(legend.textContent).not.toContain('(no value)')
  const paths = [...legend.querySelectorAll('path')].map(p =>
    p.getAttribute('d'),
  )
  expect(paths).toEqual([
    'M0 0L12 0L6 12Z',
    'M6 0L12 6L6 12L0 6Z',
    'M0 0L12 0L6 12Z',
  ])
}, 30000)

test('a y field naming no column is a skipped count in the corner, not an empty track', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_typo', [{ shape: 'bar', encoding: { y: 'scroe' } }]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_typo'), {}, { timeout }))

  const chip = await findByTestId('track-control-filter', {}, { timeout })
  expect(chip.getAttribute('aria-label')).toMatch(
    /^\d+ of \d+ features skipped: `scroe` missing or not a number$/,
  )
}, 30000)

test('spans stacked by a row channel band the plot by the highest row', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig('mark_rows', [
      {
        shape: 'span',
        encoding: {
          row: "jexl:get(feature,'name')=='EDEN.1'?0:1",
          color: { field: 'name', scale: 'categorical' },
        },
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_rows'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayDrawn).toBe('true')
  const display = view.tracks[0]!.displays[0] as { rowCount: number }
  await waitFor(() => {
    expect(display.rowCount).toBe(2)
  })
}, 30000)

test('a binned count and the raw features share one fetch, and each draws in its own zoom range', async () => {
  const { view, session, findByTestId } = await createView(
    markTrackConfig('mark_density', [
      { shape: 'bar', encoding: { y: 'score' }, maxBpPerPx: 20 },
      {
        shape: 'bar',
        transform: [
          { type: 'bin', step: 2000 },
          {
            type: 'aggregate',
            groupby: ['start', 'end'],
            ops: [{ op: 'count' }],
          },
        ],
        encoding: { y: 'count' },
        minBpPerPx: 20,
      },
    ]),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_density'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayDrawn).toBe('true')
  const display = view.tracks[0]!.displays[0] as {
    markVisible: boolean[]
    domain?: [number, number]
    rpcDataMap: ReadonlyMap<
      number,
      {
        layers: {
          count: number
          x?: Uint32Array
          x2?: Uint32Array
          y?: Float32Array
        }[]
      }
    >
    selectFeature: (hit: Record<string, unknown>) => void
  }
  expect(display.markVisible).toEqual([true, false])
  await waitFor(() => {
    expect(display.domain).toEqual([0, 1000])
  })
  // the same fetch carried the density layer: every bin counts at least one feature
  const density = [...display.rpcDataMap.values()].flatMap(d => [
    ...(d.layers[1]!.y ?? []),
  ])
  expect(density.length).toBeGreaterThan(0)
  expect(Math.min(...density)).toBeGreaterThanOrEqual(1)

  view.zoomTo(40)
  expect(display.markVisible).toEqual([false, true])
  await waitFor(() => {
    expect(display.domain![1]).toBe(Math.max(...density))
  })

  // a click on a density bar opens the bin, remade over the read-back
  const layer = display.rpcDataMap.get(0)!.layers[1]!
  const at = layer.y!.indexOf(Math.max(...density))
  display.selectFeature({
    markIndex: 1,
    regionIndex: 0,
    instance: at,
    refName: 'ctgA',
    start: layer.x![at]!,
    end: layer.x2![at]!,
    y: undefined,
    color: undefined,
    screenX: 0,
    screenY: 0,
  })
  await waitFor(() => {
    expect(session.visibleWidget).toBeDefined()
  })
  const widget = session.visibleWidget as { featureData?: unknown }
  expect(widget.featureData).toMatchObject({
    start: layer.x![at],
    end: layer.x2![at],
    count: Math.max(...density),
  })
}, 30000)

test('past a forced-small byte limit the density sidecar draws in the banner s place', async () => {
  const base = volvoxConfigWithTracks(['gff3tabix_genes'])
  const config = {
    ...base,
    tracks: base.tracks.map(t => ({
      ...t,
      trackId: 'mark_sidecar',
      name: 'mark_sidecar',
      adapter: {
        ...(t as { adapter: object }).adapter,
        densityAdapter: {
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'volvox.sort.gff3.density.bw',
            locationType: 'UriLocation',
          },
        },
      },
      displays: [
        {
          type: 'LinearMarkDisplay',
          displayId: 'mark_sidecar-marks',
          // one byte: every region on screen is over budget, so the gate
          // refuses the features and the tier is what is left
          fetchSizeLimit: 1,
          marks: [
            { shape: 'bar', encoding: { y: 'score' } },
            {
              shape: 'bar',
              source: 'density',
              encoding: { y: 'count', color: 'red' },
            },
          ],
        },
      ],
    })),
  }
  const { view, findByTestId } = await createView(config)
  view.setNewView(50, 0)
  fireEvent.click(await findByTestId(hts('mark_sidecar'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  const display = view.tracks[0]!.displays[0] as MarkDisplayProbe & {
    regionTooLarge: boolean
    coarseTierStandsIn: boolean
    densityStandInNotice?: string
  }
  await waitFor(
    () => {
      expect(display.coarseTierStandsIn).toBe(true)
    },
    { timeout },
  )
  expect(display.regionTooLarge).toBe(true)
  expect(el.dataset.displayDrawn).toBe('true')

  // the sidecar's bins are the density mark's layer, and the feature mark has
  // nothing
  const layers = [...display.rpcDataMap.values()].map(d => d.layers)
  expect(layers.length).toBeGreaterThan(0)
  for (const [features, density] of layers) {
    expect(features!.count).toBe(0)
    expect(density!.count).toBeGreaterThan(0)
  }
  // and the axis is the bins', so the plot has a scale to read them against
  expect(display.domain![1]).toBeGreaterThan(0)
  expect(display.densityStandInNotice).toContain('density sidecar')
}, 40000)

test('the mark display is offered on every track type whose adapters it reads', async () => {
  const { session } = await createView(volvoxConfigWithTracks(['volvox_bam']))
  const { pluginManager } = getEnv<{ pluginManager: PluginManager }>(session)
  for (const trackType of ['FeatureTrack', 'AlignmentsTrack', 'VariantTrack']) {
    expect(
      pluginManager.getTrackType(trackType).displayTypes.map(d => d.name),
    ).toContain('LinearMarkDisplay')
  }
}, 30000)

test('a stack over the volvox BAM is a declared pileup, its rows packed in the worker', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig(
      'mark_pileup',
      [
        {
          shape: 'span',
          transform: [{ type: 'stack' }],
          encoding: { row: 'row', color: 'red' },
        },
      ],
      'volvox_bam',
    ),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_pileup'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayDrawn).toBe('true')
  const display = probe(view)
  await waitFor(() => {
    expect(display.rowCount).toBeGreaterThan(1)
  })
  // the packing is the claim: no two reads the worker put on one row overlap
  for (const { layers } of display.rpcDataMap.values()) {
    const { x, x2, row, count } = layers[0]!
    expect(count).toBeGreaterThan(0)
    const lastEnd = new Map<number, number>()
    const order = [...x.keys()].sort((a, b) => x[a]! - x[b]!)
    for (const i of order) {
      const r = row![i]!
      expect(x[i]!).toBeGreaterThanOrEqual(lastEnd.get(r) ?? 0)
      lastEnd.set(r, x2[i]!)
    }
  }
}, 40000)

test('a coverage run and the raw reads keep two domains and two axes', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig(
      'mark_two_axes',
      [
        { shape: 'bar', encoding: { y: 'score' } },
        {
          shape: 'bar',
          transform: [{ type: 'coverage' }],
          encoding: {
            y: { field: 'coverage', resolve: 'independent' },
            color: 'blue',
          },
        },
      ],
      'volvox_bam',
    ),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_two_axes'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayDrawn).toBe('true')
  const display = probe(view)
  await waitFor(() => {
    expect(display.independentValueScale).toBeDefined()
  })
  const depths = [...display.rpcDataMap.values()].flatMap(d => [
    ...(d.layers[1]!.y ?? []),
  ])
  // the coverage layer's own extremes, and not the MAPQ layer's
  expect(display.independentValueScale!.domain[1]).toBeGreaterThanOrEqual(
    Math.max(...depths),
  )
  expect(display.independentValueScale!.field).toBe('coverage')
  expect(display.domain).not.toEqual(display.independentValueScale!.domain)
  expect(display.axes.map(a => a.side)).toEqual([undefined, 'right'])
}, 40000)

test('spans over a VCF stack the variants the worker packed', async () => {
  const { view, findByTestId } = await createView(
    markTrackConfig(
      'mark_variants',
      [
        {
          shape: 'span',
          transform: [{ type: 'stack', padding: 10000 }],
          encoding: { row: 'row', color: 'green' },
        },
      ],
      'volvox_filtered_vcf',
    ),
  )
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('mark_variants'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayId).toBe('mark_variants-marks')
  const display = probe(view)
  await waitFor(() => {
    expect(display.rowCount).toBeGreaterThan(1)
  })
}, 40000)
