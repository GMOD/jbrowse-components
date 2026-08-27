import {
  splitAlignmentSegments,
  viewSplitAlignmentRegionsInCurrentView,
} from './viewSplitAlignmentRegions.ts'

import type { LinkedReadsMode } from './constants.ts'
import type { Feature, Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const CONTIGS = [
  { refName: 'chr22', start: 0, end: 50_000 },
  { refName: 'chr9', start: 0, end: 50_000 },
]

function makeView() {
  const displayed: Region[][] = []
  const notifications: string[] = []
  const undos: (() => void)[] = []
  const view = {
    assemblyNames: ['hg38'],
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
      notify(
        message: string,
        _level: string,
        action?: { onClick: () => void },
      ) {
        notifications.push(message)
        if (action) {
          undos.push(action.onClick)
        }
      },
      assemblyManager: {
        get: () => ({
          name: 'hg38',
          getCanonicalRefName2: (refName: string) => refName,
          regions: CONTIGS,
          getRegionForRefName: (r: string) =>
            CONTIGS.find(c => c.refName === r),
        }),
      },
    },
  }
  return { view, displayed, notifications, undos }
}

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getSession: (node: { session: unknown }) => node.session,
  getNotificationSink: (node: { session: unknown }) => node.session,
  getDialogHost: (node: { session: unknown }) => node.session,
}))

function makeDisplay(linkedReads: LinkedReadsMode = 'off') {
  const modes: LinkedReadsMode[] = []
  return {
    modes,
    display: {
      get linkedReads() {
        return modes.at(-1) ?? linkedReads
      },
      setLinkedReads(mode: LinkedReadsMode) {
        modes.push(mode)
      },
    },
  }
}

function makeFeature(fields: Record<string, unknown>): Feature {
  return {
    id: () => 'read1',
    get: (key: string) => fields[key],
  } as unknown as Feature
}

// A BCR-ABL1-shaped read: 500 bp on chr22 clipped at its tail, whose tail is
// 300 bp on chr9. The SA record's clip (500S) places it after the primary.
const fusion = makeFeature({
  refName: 'chr22',
  start: 10_000,
  end: 10_500,
  strand: 1,
  CIGAR: '500M300S',
  tags: { SA: 'chr9,20001,+,500S300M,60,0;' },
})

function run(feature: Feature, linkedReads: LinkedReadsMode = 'off') {
  const { view, displayed, notifications, undos } = makeView()
  const { display, modes } = makeDisplay(linkedReads)
  viewSplitAlignmentRegionsInCurrentView({
    view: view as unknown as LinearGenomeViewModel,
    display,
    segments: splitAlignmentSegments(feature),
  })
  return { regions: displayed[0], notifications, undos, modes, view }
}

test('a read with no SA tag has no split segments', () => {
  expect(
    splitAlignmentSegments(
      makeFeature({ refName: 'chr22', start: 1, end: 2, CIGAR: '1M' }),
    ),
  ).toEqual([])
})

test('segments list the read then its SA loci, in read order', () => {
  expect(splitAlignmentSegments(fusion)).toEqual([
    { refName: 'chr22', start: 10_000, end: 10_500, clip: 0 },
    { refName: 'chr9', start: 20_000, end: 20_300, clip: 500 },
  ])
})

// Read order, not tag order: a reverse-strand primary clips 300 bp at the read's
// start (the CIGAR's tail), and the SA record covering those bases sorts first,
// since the fusion's donor is what a reader expects on the left.
test('a segment earlier in the read leads even when it is the SA record', () => {
  const rev = makeFeature({
    refName: 'chr22',
    start: 10_000,
    end: 10_500,
    strand: -1,
    CIGAR: '500M300S',
    tags: { SA: 'chr9,20001,+,300M500S,60,0;' },
  })
  expect(splitAlignmentSegments(rev).map(s => s.refName)).toEqual([
    'chr9',
    'chr22',
  ])
})

test('a truncated SA record is dropped rather than shown as a region', () => {
  const junk = makeFeature({
    refName: 'chr22',
    start: 10_000,
    end: 10_500,
    strand: 1,
    CIGAR: '500M300S',
    tags: { SA: 'chr9,20001,+,500S,60,0;' },
  })
  expect(splitAlignmentSegments(junk)).toHaveLength(1)
})

test('shows one region per segment, each padded by its own length', () => {
  const { regions } = run(fusion)
  expect(regions).toEqual([
    expect.objectContaining({ refName: 'chr22', start: 9_500, end: 11_000 }),
    expect.objectContaining({ refName: 'chr9', start: 19_700, end: 20_600 }),
  ])
})

test('enters chain layout and Undo leaves it again', () => {
  const { modes, undos, notifications, view } = run(fusion)
  expect(modes).toEqual(['normal'])
  expect(notifications).toEqual(['Showing 2 aligned segments of this read'])
  undos[0]!()
  expect(modes).toEqual(['normal', 'off'])
  expect(view.displayedRegions).toEqual([])
})

// The count is the view's, not the segment list's. Two segments a few hundred
// bases apart on one contig pad into windows that touch, and gatherOverlaps
// makes them one region — announcing 2 named a window nobody could find.
test('counts the regions the view shows, after touching ones merge', () => {
  const near = makeFeature({
    refName: 'chr22',
    start: 10_000,
    end: 10_500,
    strand: 1,
    CIGAR: '500M300S',
    tags: { SA: 'chr22,10601,+,500S300M,60,0;' },
  })
  const { regions, notifications } = run(near)
  expect(regions).toHaveLength(1)
  expect(notifications).toEqual(['Showing 1 aligned segment of this read'])
})

test('leaves chain layout alone when it was already on', () => {
  const { modes, undos } = run(fusion, 'normal')
  expect(modes).toEqual([])
  undos[0]!()
  expect(modes).toEqual([])
})

test('names a segment past the end of its contig instead of inverting it', () => {
  const far = makeFeature({
    refName: 'chr22',
    start: 10_000,
    end: 10_500,
    strand: 1,
    CIGAR: '500M300S',
    tags: { SA: 'chr9,80001,+,500S300M,60,0;' },
  })
  const { regions, notifications } = run(far)
  expect(regions).toHaveLength(1)
  expect(regions!.every(r => r.end > r.start)).toBe(true)
  expect(notifications).toEqual([
    'Showing 1 aligned segment of this read — 1 segment past the end of chr9 left out',
  ])
})
