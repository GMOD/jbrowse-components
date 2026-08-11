import { SimpleFeature } from '@jbrowse/core/util'

import {
  containingPanelStack,
  matePanelIndexes,
  matePanelLocString,
} from './matePanelNavigation.ts'
import { createPanelStack } from './testEnv.ts'

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
    }),
  ).toEqual([1])
  expect(
    matePanelIndexes({
      panelAssemblies: ['hg002v1.2', 'hg002v1.2'],
      anchorIndex: 1,
      mateAssemblyName: 'hg002v1.2',
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
    }),
  ).toEqual([])
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
// tier) interpolates across itself instead, which is the geometry its ribbon is
// drawn with.
test('a CIGAR-less block interpolates the same window', () => {
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
  ).toBe('chr8_PATERNAL:2000001..2100000')
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
