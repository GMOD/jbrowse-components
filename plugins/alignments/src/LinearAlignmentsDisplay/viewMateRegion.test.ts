import { viewMateRegionInCurrentView } from './viewMateRegion.ts'

import type { MateFields } from '../shared/mateFeature.ts'
import type { Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const CONTIGS = [
  { refName: 'ctgA', start: 0, end: 50_000 },
  { refName: 'ctgB', start: 0, end: 50_000 },
]

// A view that records what it was asked to display, plus the assembly
// `clampToContig` reads bounds from.
function makeView() {
  const displayed: Region[][] = []
  const notifications: string[] = []
  const view = {
    assemblyNames: ['volvox'],
    displayedRegions: [] as Region[],
    windowWidthBp: 1000,
    windowStartBp: 0,
    setDisplayedRegions(regions: Region[]) {
      displayed.push(regions)
      view.displayedRegions = regions
    },
    fitAllRegions() {},
    setWindow() {},
    session: {
      notify(message: string) {
        notifications.push(message)
      },
      assemblyManager: {
        get: () => ({
          name: 'volvox',
          getCanonicalRefName2: (refName: string) => refName,
          regions: CONTIGS,
          getRegionForRefName: (r: string) =>
            CONTIGS.find(c => c.refName === r),
        }),
      },
    },
  }
  return { view, displayed, notifications }
}

// getSession walks up the MST tree, which a plain object has none of, so the
// harness hangs the session off the view and the module reads it back.
jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getSession: (node: { session: unknown }) => node.session,
}))

function mate(over: Partial<MateFields> = {}): MateFields {
  return {
    uniqueId: 'read1',
    refName: 'ctgA',
    start: 1000,
    end: 1150,
    strand: 1,
    nextRef: 'ctgA',
    nextPos: 1100,
    mateStrand: -1,
    ...over,
  }
}

function show(m: MateFields) {
  const { view, displayed } = makeView()
  viewMateRegionInCurrentView({
    view: view as unknown as LinearGenomeViewModel,
    mate: m,
  })
  return displayed[0]!
}

// The commonest case by far, and the one this used to get wrong: each locus is
// padded by a read length, so for a normal insert the two windows overlap and
// the same reads were drawn twice with a region boundary through the middle of
// the pair.
test('a proper pair shows one region, not the same locus twice', () => {
  const regions = show(mate())
  expect(regions).toHaveLength(1)
  expect(regions[0]).toMatchObject({
    refName: 'ctgA',
    start: 850,
    end: 1400,
  })
})

// What the feature is actually for: far enough apart that two windows say
// something the one merged window would not.
test('a distant mate on the same contig stays two regions', () => {
  const regions = show(mate({ nextPos: 40_000 }))
  expect(regions).toHaveLength(2)
  expect(regions[0]).toMatchObject({ refName: 'ctgA', start: 850, end: 1300 })
  expect(regions[1]).toMatchObject({
    refName: 'ctgA',
    start: 39_850,
    end: 40_300,
  })
})

test('an inter-chromosomal mate stays two regions', () => {
  const regions = show(mate({ nextRef: 'ctgB', nextPos: 1100 }))
  expect(regions).toHaveLength(2)
  expect(regions.map(r => r.refName)).toEqual(['ctgA', 'ctgB'])
})

// Abutting rather than overlapping still merges: a boundary drawn exactly
// between two touching windows is the same visual seam for no reason.
test('windows that merely touch merge too', () => {
  const regions = show(mate({ start: 1000, end: 1100, nextPos: 1300 }))
  expect(regions).toHaveLength(1)
  expect(regions[0]).toMatchObject({ start: 900, end: 1500 })
})

// The clamp is what keeps a padded window inside the contig; merging must not
// reintroduce coordinates outside it.
test('the merged region stays inside the assembly bounds', () => {
  const regions = show(mate({ start: 10, end: 60, nextPos: 30 }))
  expect(regions).toHaveLength(1)
  expect(regions[0]!.start).toBe(0)
})
