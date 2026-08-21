import { SimpleFeature } from '@jbrowse/core/util'

import {
  containingPanelStack,
  matePanelIndexes,
  matePanelLocString,
} from './matePanelNavigation.ts'
import { createPanelStack } from './testEnv.ts'

// The one method `matePanelIndexes` needs of an assembly manager. `hg38` here
// answers to `GRCh38` as well, which is what a session with an `aliases` entry
// gives a view opened on either spelling.
const assemblyManager = {
  getCanonicalAssemblyName: (name: string) =>
    ({ GRCh38: 'hg38', hg38: 'hg38' })[name],
}

// A published haplotype-to-haplotype chain: one 10 Mb block, matching 1:1
// except for a 1000 bp deletion in the mate a tenth of the way in.
function chainFeature() {
  return new SimpleFeature({
    uniqueId: 'chain1',
    refName: 'chr8_MATERNAL',
    start: 0,
    end: 10_000_000,
    strand: 1,
    CIGAR: '1000000M1000D8999000M',
    mate: {
      refName: 'chr8_PATERNAL',
      start: 0,
      end: 9_999_000,
      assemblyName: 'hg002v1.2',
    },
  })
}

test('a two-panel stack moves the panel opposite the one clicked', () => {
  expect(
    matePanelIndexes({
      panelAssemblies: ['hg002v1.2', 'hg002v1.2'],
      anchorIndex: 0,
      mateAssemblyName: 'hg002v1.2',
      assemblyManager,
    }),
  ).toEqual([1])
  expect(
    matePanelIndexes({
      panelAssemblies: ['hg002v1.2', 'hg002v1.2'],
      anchorIndex: 1,
      mateAssemblyName: 'hg002v1.2',
      assemblyManager,
    }),
  ).toEqual([0])
})

// A band is drawn between adjacent panels only, so an alignment in the middle
// panel says something about both its neighbours and nothing about anything
// further away.
test('a middle panel moves both its neighbours and no further', () => {
  expect(
    matePanelIndexes({
      panelAssemblies: ['hg38', 'hg38', 'hg38', 'hg38'],
      anchorIndex: 1,
      mateAssemblyName: 'hg38',
      assemblyManager,
    }),
  ).toEqual([0, 2])
})

// The filter that keeps a stack of different genomes from sending a neighbour
// to a refName it does not have.
test('a neighbour on another assembly is left alone', () => {
  expect(
    matePanelIndexes({
      panelAssemblies: ['hg38', 'mm10', 'galGal6'],
      anchorIndex: 1,
      mateAssemblyName: 'galGal6',
      assemblyManager,
    }),
  ).toEqual([2])
})

// A mate the adapter set no assembly on cannot name a panel, and guessing the
// neighbour's would move it somewhere the alignment never claimed.
test('a mate with no assembly moves nothing', () => {
  expect(
    matePanelIndexes({
      panelAssemblies: ['hg38', 'hg38'],
      anchorIndex: 0,
      mateAssemblyName: undefined,
      assemblyManager,
    }),
  ).toEqual([])
})

// A panel holds the name the session opened it on and a mate holds the one the
// adapter resolved out of the track's `assemblyNames`, so one assembly reaches
// this comparison under two spellings. Raw `===` left the menu item absent on
// exactly the stack it is for.
test('a panel opened on an alias of the mate assembly still moves', () => {
  expect(
    matePanelIndexes({
      panelAssemblies: ['GRCh38', 'GRCh38'],
      anchorIndex: 0,
      mateAssemblyName: 'hg38',
      assemblyManager,
    }),
  ).toEqual([1])
})

// Degrading to the raw name is what keeps an all-vs-all file's undeclared PanSN
// samples working: the assembly manager knows none of them, and they still have
// to compare equal to themselves.
test('a name the assembly manager does not know compares as written', () => {
  expect(
    matePanelIndexes({
      panelAssemblies: ['grape#1', 'grape#1'],
      anchorIndex: 0,
      mateAssemblyName: 'grape#1',
      assemblyManager,
    }),
  ).toEqual([1])
  expect(
    matePanelIndexes({
      panelAssemblies: ['grape#1', 'grape#2'],
      anchorIndex: 0,
      mateAssemblyName: 'grape#3',
      assemblyManager,
    }),
  ).toEqual([])
})

// `panelAssemblies` is indexed by panel position, so a view that has not
// initialized leaves a hole rather than shortening the list. Resolving names in
// place is what keeps the index of every panel after it correct.
test('an uninitialized panel holds its index open', () => {
  expect(
    matePanelIndexes({
      panelAssemblies: [undefined, 'GRCh38', 'hg38'],
      anchorIndex: 2,
      mateAssemblyName: 'hg38',
      assemblyManager,
    }),
  ).toEqual([1])
})

// The whole reason this is not "Center on feature": the visible window, walked
// through the CIGAR, lands past the block's 1000 bp deletion — 1000 bp short of
// where the maternal coordinates sit, and nowhere near the block's midpoint.
test('the locstring is the visible window walked through the CIGAR', () => {
  expect(
    matePanelLocString(chainFeature(), { start: 2_000_000, end: 2_100_000 }),
  ).toBe('chr8_PATERNAL:1999001..2099000')
})

// A block with no CIGAR (minimap2 without -c, MashMap, MCScan, a PIF's coarse
// tier) has no walkable correspondence, and this refuses rather than
// interpolating one. The launch path still interpolates -- its dialog pads the
// result and shows what it resolved -- but a panel navigated flush against its
// neighbour presents the guess as a correspondence. On a coarse PIF tier the
// skew is not even bounded by the 10 kb split threshold `make-pif` uses, since
// smaller indels accumulate without triggering a split.
test('a CIGAR-less block names no region', () => {
  const feature = new SimpleFeature({
    uniqueId: 'block1',
    refName: 'chr8_MATERNAL',
    start: 0,
    end: 10_000_000,
    strand: 1,
    mate: {
      refName: 'chr8_PATERNAL',
      start: 0,
      end: 10_000_000,
      assemblyName: 'hg002v1.2',
    },
  })
  expect(
    matePanelLocString(feature, { start: 2_000_000, end: 2_100_000 }),
  ).toBeUndefined()
})

test('a feature with no mate names no region', () => {
  const feature = new SimpleFeature({
    uniqueId: 'x',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  expect(matePanelLocString(feature, { start: 0, end: 100 })).toBeUndefined()
})

// The walk has to stop at the session rather than take its `views` array: the
// session holds the STACK, not the panel, so a `views`-array test that did not
// also check membership would report the session as the panel's stack.
test('a panel finds its stack and a standalone view finds none', () => {
  const { stack, panels, standalone } = createPanelStack()
  expect(containingPanelStack(panels[0]!)).toBe(stack)
  expect(containingPanelStack(panels[1]!)).toBe(stack)
  expect(containingPanelStack(standalone)).toBeUndefined()
})
