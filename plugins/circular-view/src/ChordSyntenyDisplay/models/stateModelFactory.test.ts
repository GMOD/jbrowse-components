import { colord } from '@jbrowse/core/util/colord'
import { applySnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { autorun, when } from 'mobx'

import { DIMMED_ALPHA } from '../../chords/types.ts'

import type { CircularViewModel } from '../../CircularView/model.ts'
import type { Slice } from '../../CircularView/slices.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function addAssemblyConf(
  session: ReturnType<typeof createTestSession>,
  name: string,
) {
  session.addAssemblyConf({
    name,
    sequence: {
      trackId: `${name}_refseq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: ['ctgA', 'ctgB'].map(refName => ({
          refName,
          uniqueId: refName,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        })),
      },
    },
  })
}

function addTrackConf(
  session: ReturnType<typeof createTestSession>,
  assemblyNames: string[],
) {
  const [query, target] = assemblyNames as [string, string]
  session.addSessionTrackConf({
    trackId: 'aln',
    type: 'SyntenyTrack',
    name: 'my alignments',
    assemblyNames,
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'aln1',
          assemblyName: query,
          refName: 'ctgA',
          start: 100,
          end: 200,
          strand: -1,
          mate: {
            assemblyName: target,
            refName: 'ctgB',
            start: 1000,
            end: 1100,
          },
        },
      ],
    },
  })
}

function assemblyOf(slice: Slice | undefined) {
  const region = slice?.region
  if (!region) {
    return undefined
  }
  return region.elided ? region.regions[0]!.assemblyName : region.assemblyName
}

async function setup(assemblyNames: string[]) {
  const session = createTestSession()
  for (const name of new Set(assemblyNames)) {
    addAssemblyConf(session, name)
  }
  addTrackConf(session, assemblyNames)
  const view = (await session.launchView('CircularView', {
    assembly: [...new Set(assemblyNames)],
    tracks: ['aln'],
  })) as CircularViewModel
  view.setWidth(800)
  for (const name of new Set(assemblyNames)) {
    await session.assemblyManager.waitForAssembly(name)
  }
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]!
  await when(() => display.ready)
  return { session, view, display }
}

test('a self-alignment places both ends on the one assembly', async () => {
  const { display } = await setup(['volvox', 'volvox'])
  expect(display.type).toBe('ChordSyntenyDisplay')
  expect(display.features).toHaveLength(1)
  const feature = display.features[0]!
  expect(assemblyOf(display.sliceFor('volvox', 'ctgA'))).toBe('volvox')
  expect(
    assemblyOf(display.sliceFor(feature.get('assemblyName'), 'ctgB')),
  ).toBe('volvox')
}, 20000)

// The reason the index is keyed by assembly as well as refName: each of these
// assemblies has a ctgA and a ctgB, so a refName-keyed table would answer
// whichever slice it wrote last and draw both ends on one genome. Compared by
// what the slice IS rather than by identity — `staticSlices` is an unobserved
// computed, so it hands back fresh Slice objects on every read.
test('two assemblies keep their own contigs of the same name', async () => {
  const { view, display } = await setup(['volvox', 'volvox2'])
  expect(view.assemblyNames).toEqual(['volvox', 'volvox2'])
  expect(assemblyOf(display.sliceFor('volvox', 'ctgA'))).toBe('volvox')
  expect(assemblyOf(display.sliceFor('volvox2', 'ctgA'))).toBe('volvox2')
}, 20000)

// a track may name an assembly by its alias, and its features then carry the
// alias too; the circle names it canonically
test('a track spelling an assembly by its alias places and reorders by the canonical one', async () => {
  const session = createTestSession()
  addAssemblyConf(session, 'volvox')
  addAssemblyConf(session, 'volvox2')
  session.assemblyManager
    .get('volvox2')!
    .configuration.setSlot('aliases', ['v2'])
  addTrackConf(session, ['volvox', 'v2'])
  const view = (await session.launchView('CircularView', {
    assembly: ['volvox', 'volvox2'],
    tracks: ['aln'],
  })) as CircularViewModel
  view.setWidth(800)
  await when(() => view.tracks.length > 0)
  const display = view.tracks[0]!.displays[0]!
  await when(() => display.ready)
  expect(display.trackAssemblyNames).toEqual(['volvox', 'volvox2'])
  expect(assemblyOf(display.sliceFor('v2', 'ctgB'))).toBe('volvox2')
  expect(display.alignmentsBetween('volvox', 'volvox2')).toEqual([
    expect.objectContaining({ refRefName: 'ctgA', queryRefName: 'ctgB' }),
  ])
}, 20000)

test('reload() rewakes the fetch after an error', async () => {
  const { display } = await setup(['volvox', 'volvox'])

  display.setError(new Error('adapter fell over'))
  expect(display.displayPhase).toBe('error')
  display.reload()
  expect(display.displayPhase).not.toBe('error')

  // the fetch key is unchanged, so only the reload gets past it
  await when(() => display.features === undefined)
  await when(() => display.ready)
  expect(display.features).toHaveLength(1)
}, 20000)

// query paints the first genome's end and target the second, each in its
// chromosome's ideogram colour, so a ribbon matches the arc it leaves; every
// mode paints at the view's alpha
// a ribbon paints its colour opaque and every ribbon draws at one opacity, so
// an opacity drag repaints none of them
test("the view's color paints each ribbon, at the view's alpha", async () => {
  const { session, view, display } = await setup(['volvox', 'volvox2'])
  const [feature] = display.features!
  const ideogram = (assembly: string, refName: string) =>
    colord(
      session.assemblyManager.get(assembly)!.getRefNameColor(refName)!,
    ).toHex()

  view.setColorField('query')
  expect(display.ribbonFill(feature)).toBe(ideogram('volvox', 'ctgA'))
  view.setColorField('target')
  expect(display.ribbonFill(feature)).toBe(ideogram('volvox2', 'ctgB'))
  expect(display.ribbonOpacity).toBe(0.25)
  view.setColorField('strand')
  view.setAlpha(0.5)
  expect(display.ribbonFill(feature)).toBe('#0000ff')
  expect(display.ribbonOpacity).toBe(0.5)
}, 20000)

// a hidden row would still take the pointer through its transparent fill
test('a ribbon its colour paints transparent is not drawn', async () => {
  const { view, display } = await setup(['volvox', 'volvox2'])
  expect(display.drawnFeatures).toHaveLength(1)
  applySnapshot(view.color, { value: 'rgba(0,0,0,0)' })
  expect(display.drawnFeatures).toHaveLength(0)
}, 20000)

test("a ribbon shorter than the view's minimum length is not drawn", async () => {
  const { view, display } = await setup(['volvox', 'volvox2'])
  expect(display.drawnFeatures).toHaveLength(1)
  view.setMinAlignmentLength(101)
  expect(display.drawnFeatures).toHaveLength(0)
}, 20000)

// each end resolves against its own assembly's slices, which is what a
// two-assembly circle needs: both genomes here have a ctgA and a ctgB
test('an alignment across two assemblies is one ribbon', async () => {
  const { view, display } = await setup(['volvox', 'volvox2'])
  const lanes = display.ribbonLanes
  expect(lanes.count).toBe(1)
  const own = view.chordAxis.slices[lanes.xSlice[0]!]!
  const mate = view.chordAxis.slices[lanes.ySlice[0]!]!
  expect(view.elidedRegions[own.index]).toMatchObject({
    assemblyName: 'volvox',
    refName: 'ctgA',
  })
  expect(view.elidedRegions[mate.index]).toMatchObject({
    assemblyName: 'volvox2',
    refName: 'ctgB',
  })
}, 20000)

test('an end whose region is off the circle draws no ribbon', async () => {
  const { view, display } = await setup(['volvox', 'volvox2'])
  view.setDisplayedRegions(
    view.displayedRegions.filter(r => r.assemblyName === 'volvox'),
  )
  expect(display.ribbonLanes.count).toBe(0)
}, 20000)

// the polar stage is uniforms, so what the canvas uploads is untouched by
// either; observed, since an unobserved getter is a fresh object per read
test('a rotation or a zoom leaves the uploaded cell as it was', async () => {
  const { view, display } = await setup(['volvox', 'volvox2'])
  const cells: unknown[] = []
  const dispose = autorun(() => {
    cells.push(display.chordCell)
  })
  view.rotate(0.7)
  view.zoomToPoint(view.bpPerPx * 0.8, 10, 10)
  dispose()
  expect(cells).toHaveLength(1)
  expect(cells[0]).toBeDefined()
}, 20000)

test("the SV inspector's dimming reaches the ribbon's alpha", async () => {
  const { display } = await setup(['volvox', 'volvox2'])
  expect(display.ribbonLanes.color[0]! >>> 24).toBe(255)
  display.setHighlightedFeatureIds([])
  expect(display.ribbonLanes.color[0]! >>> 24).toBe(DIMMED_ALPHA)
}, 20000)
