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
    showRegions(regions: Region[]) {
      view.setDisplayedRegions(regions)
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

function run(m: MateFields) {
  const { view, displayed, notifications } = makeView()
  viewMateRegionInCurrentView({
    view: view as unknown as LinearGenomeViewModel,
    mate: m,
  })
  return { regions: displayed[0], notifications }
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

// The reason this routes through clampToContig at all. A BAM aligned against a
// longer assembly than the FASTA in use puts a mate past the end of its contig,
// and the one-sided clamp this used to write returned end < start there — which
// setDisplayedRegions accepts and every sum of region lengths then subtracts.
test('a mate past the end of its contig is dropped, not inverted', () => {
  const { regions } = run(mate({ nextPos: 80_000 }))

  expect(regions).toHaveLength(1)
  expect(regions![0]).toMatchObject({ refName: 'ctgA', start: 850, end: 1300 })
  expect(regions!.every(r => r.end > r.start)).toBe(true)
})

// One region is also what a proper pair merges to, so the view cannot show that
// the mate went missing and the message has to.
test('says so when the mate is the half that was dropped', () => {
  const { notifications } = run(mate({ nextRef: 'ctgB', nextPos: 80_000 }))

  expect(notifications).toEqual([
    'Showing this read only — its mate lies past the end of ctgB',
  ])
})

test('warns and displays nothing when neither locus lands on a contig', () => {
  const { regions, notifications } = run(
    mate({ start: 80_000, end: 80_150, nextPos: 90_000 }),
  )

  expect(regions).toBeUndefined()
  expect(notifications).toEqual([
    'Neither this read nor its mate lands inside a contig of volvox',
  ])
})
