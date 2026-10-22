import { setConf } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { navToLoc } from '@jbrowse/sv-core'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from '../../CircularView/model.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'

function sliceFor(
  display: {
    axisSlice: (
      a: string | undefined,
      r: string,
    ) => { index: number } | undefined
    view: {
      staticSlices: { region: { refName: string; assemblyName: string } }[]
    }
  },
  assemblyName: string | undefined,
  refName: string,
) {
  const axis = display.axisSlice(assemblyName, refName)
  return axis && display.view.staticSlices[axis.index]
}

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// the default chord color under the default 0.32 opacity, as a byte
const DEFAULT_SWATCH = `rgba(255,133,0,${82 / 255})`

function addConf(
  session: ReturnType<typeof createTestSession>,
  assemblies = ['volvox'],
  extraFeatures: Record<string, unknown>[] = [],
) {
  for (const name of assemblies) {
    session.addAssemblyConf({
      name,
      sequence: {
        trackId: `${name}_refseq`,
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'FromConfigSequenceAdapter',
          features: [
            {
              refName: 'ctgA',
              uniqueId: 'ctgA',
              start: 0,
              end: 16000,
              seq: 'a'.repeat(16000),
            },
            {
              refName: 'ctgB',
              uniqueId: 'ctgB',
              start: 0,
              end: 8000,
              seq: 'a'.repeat(8000),
            },
          ],
        },
      },
    })
  }
  session.addSessionTrackConf({
    trackId: 'sv',
    type: 'VariantTrack',
    name: 'my svs',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'sv1',
          refName: 'ctgA',
          start: 100,
          end: 200,
          svType: 'DEL',
          mate: { refName: 'ctgB', start: 1000, end: 1100 },
        },
        ...extraFeatures,
      ],
    },
  })
}

async function setup(
  assemblies = ['volvox'],
  extraFeatures: Record<string, unknown>[] = [],
) {
  const session = createTestSession()
  addConf(session, assemblies, extraFeatures)
  const view = (await session.launchView('CircularView', {
    assembly: assemblies,
    tracks: ['sv'],
  })) as CircularViewModel
  view.setWidth(800)
  for (const name of assemblies) {
    await session.assemblyManager.waitForAssembly(name)
  }
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]!
  await when(() => display.ready)
  return { session, view, display }
}

test('a ready display places both ends of its chords', async () => {
  const { display } = await setup()
  expect(display.features).toHaveLength(1)
  expect(sliceFor(display, undefined, 'ctgA')?.region.refName).toBe('ctgA')
  expect(sliceFor(display, undefined, 'ctgB')?.region.refName).toBe('ctgB')
}, 20000)

test('a constant color keys as one row, a field as the values it paints', async () => {
  const { display } = await setup(undefined, [
    {
      uniqueId: 'sv2',
      refName: 'ctgA',
      start: 5000,
      end: 5100,
      svType: 'INV',
      mate: { refName: 'ctgB', start: 6000, end: 6100 },
    },
  ])
  expect(display.legendColor).toBe(DEFAULT_SWATCH)
  expect(display.colorScales).toEqual([])

  setConf(display, ['encoding', 'color'], 'svType')
  setConf(display, 'opacity', 0.45)
  const [feature] = display.chordLanes.features
  expect(display.chordStrokes.get(feature)).toBe('#e41a1c')
  expect(display.shapeAlpha).toBe(0.45)
  expect(display.legendColor).toBeUndefined()
  const [scale]: ColorScale[] = display.colorScales
  expect(scale?.title).toBe('SV type')
  expect(
    scale?.kind === 'categorical' && scale.entries.map(e => [e.label, e.color]),
  ).toEqual([
    ['Deletion', `rgba(228,26,28,${115 / 255})`],
    ['Inversion', `rgba(255,127,0,${115 / 255})`],
  ])

  setConf(display, ['encoding', 'color'], {
    field: 'svType',
    scale: { domain: ['DEL'], range: ['#aa0000'], unknown: '#cccccc' },
  })
  const [listed]: ColorScale[] = display.colorScales
  expect(
    listed?.kind === 'categorical' && listed.entries.map(e => e.label),
  ).toEqual(['Deletion', 'Other'])
})

test('clicking a chord selects the record and opens its details', async () => {
  const { session, display } = await setup()
  display.onChordClick(display.features[0])
  expect(session.selection).toBe(display.features[0])
  expect(session.widgets.get('variantFeature')?.type).toBe(
    'VariantFeatureWidget',
  )
}, 20000)

// the circle cannot navigate to a locus, so the details panel's link opens one
test("the details panel's zoom link opens the locus in a linear view", async () => {
  const { session, view, display } = await setup()
  display.onChordClick(display.features[0])
  navToLoc('ctgA:101-200', session.widgets.get('variantFeature'))
  const linear = session.views.find(v => v.id === `${view.id}-linear`)
  expect(linear?.type).toBe('LinearGenomeView')
}, 20000)

test('an onChordClick callback runs in place of the details', async () => {
  const { session, display } = await setup()
  const clicked: unknown[] = []
  getEnv(session).pluginManager.jexl.addFunction(
    'recordChordClick',
    (feature: unknown) => {
      clicked.push(feature)
    },
  )
  setConf(display, 'onChordClick', 'jexl:recordChordClick(feature)')
  display.onChordClick(display.features[0])
  expect(clicked).toHaveLength(1)
  expect(session.widgets.has('variantFeature')).toBe(false)
}, 20000)

// A VCF names one genome, and both genomes on the circle carry a ctgA: the
// chords are fetched over, and placed on, the track's own genome's arcs
test('a one-genome variant track on a two-genome circle keeps to its genome', async () => {
  const { display } = await setup(['volvox', 'volvox2'])
  expect(display.trackAssemblyNames).toEqual(['volvox'])
  expect(display.features).toHaveLength(1)
  expect(sliceFor(display, undefined, 'ctgB')?.region.assemblyName).toBe(
    'volvox',
  )
}, 20000)

// `ready` is this display's whole freshness answer, so the old features must
// not outlive a region change into the new layout
test('a region change blanks the features until the refetch lands', async () => {
  const { view, display } = await setup()

  view.setDisplayedRegions([view.displayedRegions[0]!])

  await when(() => display.features === undefined)
  expect(display.displayPhase).toBe('loading')

  await when(() => display.ready)
  expect(display.displayPhase).toBe('ready')
}, 20000)

// After a fetch error every other input of the fetch autorun is unchanged, so
// `reload()`'s pure signal is the only thing that can rewake it. Fails if the
// `reloadCounter` read is deleted from the autorun body, or moved under a gate.
test('reload() rewakes the fetch after an error', async () => {
  const { display } = await setup()

  display.setError(new Error('adapter fell over'))
  expect(display.displayPhase).toBe('error')
  display.reload()
  expect(display.displayPhase).not.toBe('error')

  // the fetch key is unchanged, so only the reload gets past it
  await when(() => display.features === undefined)
  await when(() => display.ready)
  expect(display.features).toHaveLength(1)
}, 20000)

// A caller that writes one record per translocation leaves the mate's contig
// with no record of its own, so the file never names it and the adapter's name
// table has no entry for it
test('a mate on a contig the file holds no record on still finds its slice', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    refNameAliases: {
      adapter: {
        type: 'FromConfigAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A'] },
          { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B'] },
        ],
      },
    },
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
          {
            refName: 'ctgB',
            uniqueId: 'ctgB',
            start: 0,
            end: 8000,
            seq: 'a'.repeat(8000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'sv',
    type: 'VariantTrack',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'tra1',
          refName: 'A',
          start: 100,
          end: 101,
          mate: { refName: 'B', start: 1000, end: 1001 },
        },
      ],
    },
  })
  const view = (await session.launchView('CircularView', {
    assembly: 'volvox',
    tracks: ['sv'],
  })) as CircularViewModel
  view.setWidth(800)
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]!
  await when(() => display.ready)
  expect(display.features).toHaveLength(1)
  expect(sliceFor(display, undefined, 'A')?.region.refName).toBe('ctgA')
  expect(sliceFor(display, undefined, 'B')?.region.refName).toBe('ctgB')
}, 20000)

// an elided slice stands for every contig in its run, so two records that
// land on different contigs of one run are two chords, not a breakend pair
test('chords into one elided run keep their own lanes', async () => {
  const session = createTestSession()
  const contig = (refName: string, end: number) => ({
    refName,
    uniqueId: refName,
    start: 0,
    end,
    seq: 'a'.repeat(end),
  })
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          contig('big', 1_000_000),
          contig('u1', 10),
          contig('u2', 10),
        ],
      },
    },
  })
  const tra = (uniqueId: string, mate: string) => ({
    uniqueId,
    refName: 'big',
    start: 100,
    end: 101,
    mate: { refName: mate, start: 5, end: 6 },
  })
  session.addSessionTrackConf({
    trackId: 'sv',
    type: 'VariantTrack',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [tra('to-u1', 'u1'), tra('to-u2', 'u2')],
    },
  })
  const view = (await session.launchView('CircularView', {
    assembly: 'volvox',
    tracks: ['sv'],
  })) as CircularViewModel
  view.setWidth(800)
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]!
  await when(() => display.ready)
  expect(view.elidedRegions.some(r => r.elided)).toBe(true)
  expect(display.chordLanes.count).toBe(2)
  expect(display.laneIndexById.get('to-u2')).not.toBe(
    display.laneIndexById.get('to-u1'),
  )
}, 20000)

function subMenuOf(item: MenuItem | undefined): MenuItem[] {
  return item && 'subMenu' in item && Array.isArray(item.subMenu)
    ? item.subMenu
    : []
}

const labelOf = (item: MenuItem) => ('label' in item ? item.label : undefined)

function colorByRows(display: { trackMenuItems: () => MenuItem[] }) {
  return subMenuOf(
    display.trackMenuItems().find(i => labelOf(i) === 'Color by...'),
  )
}

function clickRow(rows: MenuItem[], label: string) {
  const found = rows.find(r => labelOf(r) === label)
  if (!found || !('onClick' in found)) {
    throw new Error(`no ${label} row`)
  }
  found.onClick()
}

const ticked = (rows: MenuItem[]) =>
  rows.filter(r => 'checked' in r && r.checked).map(labelOf)

test('the track menu picks the chord color through Color by', async () => {
  const { session, display } = await setup()
  expect(ticked(colorByRows(display))).toEqual(['Default'])

  clickRow(colorByRows(display), 'SV type')
  expect(display.writtenColor).toEqual({ field: 'svType' })
  expect(ticked(colorByRows(display))).toEqual(['SV type'])

  clickRow(colorByRows(display), 'Solid color...')
  expect(session.DialogProps?.label).toBe('Chord color')
  ;(session.DialogProps?.onChange as (c: string) => void)('#123456')
  expect(display.writtenColor).toEqual({ value: '#123456' })
  expect(display.legendColor).toBe(`rgba(18,52,86,${82 / 255})`)
  expect(ticked(colorByRows(display))).toEqual(['Solid color...'])

  clickRow(colorByRows(display), 'Default')
  expect(display.writtenColor).toEqual({})
  expect(display.parkedColor).toEqual({ field: 'svType' })
  expect(display.legendColor).toBe(DEFAULT_SWATCH)
  expect(ticked(colorByRows(display))).toEqual(['Default'])
}, 20000)

test("the view's Tracks menu carries the display's Color by and Edit plot", async () => {
  const { view } = await setup()
  const [trackItem] = subMenuOf(view.tracksMenuItem())
  const rows = subMenuOf(trackItem)
  expect(rows.map(labelOf)).toEqual(
    expect.arrayContaining(['Color by...', 'Advanced']),
  )
  expect(
    subMenuOf(rows.find(i => labelOf(i) === 'Advanced')).map(labelOf),
  ).toEqual(['Edit plot...'])
}, 20000)
