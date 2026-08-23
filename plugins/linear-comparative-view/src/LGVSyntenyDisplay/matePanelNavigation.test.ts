import { SimpleFeature } from '@jbrowse/core/util'

import {
  containingPanelStack,
  matePanelIndexes,
  matePanelSpan,
  moveMatePanels,
} from './matePanelNavigation.ts'
import { createPanelStack } from './testEnv.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
//
// A span rather than a locstring, so `moveMatePanels` can hand it to
// `navToResolvedSpan` and reach `navTo` — which moves the panel inside the
// regions it already displays instead of replacing them with this one contig.
test('the span is the visible window walked through the CIGAR', () => {
  expect(
    matePanelSpan(chainFeature(), { start: 2_000_000, end: 2_100_000 }),
  ).toEqual({ refName: 'chr8_PATERNAL', start: 1_999_000, end: 2_099_000 })
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
    matePanelSpan(feature, { start: 2_000_000, end: 2_100_000 }),
  ).toBeUndefined()
})

test('a feature with no mate names no region', () => {
  const feature = new SimpleFeature({
    uniqueId: 'x',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  expect(matePanelSpan(feature, { start: 0, end: 100 })).toBeUndefined()
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

// A panel, as much of one as the move touches. `navTo` resolving is what stands
// for "the span is inside the regions this panel already displays".
function movablePanel({ reachable = true } = {}) {
  const navTo = jest.fn(() => {
    if (!reachable) {
      throw new Error('not in displayed regions')
    }
  })
  const navToLocString = jest.fn(() => Promise.resolve(true))
  return {
    navTo,
    navToLocString,
  } as unknown as LinearGenomeViewModel & {
    navTo: jest.Mock
    navToLocString: jest.Mock
  }
}

const session = {
  notifyError: jest.fn(),
} as unknown as AbstractSessionModel

const window = { start: 2_000_000, end: 2_100_000 }

// `navToLocString` REPLACES `displayedRegions` with the single contig it lands
// on, and the synteny fetch keeps a block only when both ends are in view — so a
// whole-genome panel moved once was narrowed permanently, losing the ribbons the
// move exists to line up. `navTo` moves inside the regions the panel already
// has.
test('a panel that can reach the span is moved without replacing its regions', () => {
  const panel = movablePanel()
  moveMatePanels({
    stack: { views: [movablePanel(), panel] },
    anchorIndex: 0,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(panel.navTo).toHaveBeenCalledWith({
    refName: 'chr8_PATERNAL',
    start: 1_999_000,
    end: 2_099_000,
  })
  expect(panel.navToLocString).not.toHaveBeenCalled()
})

// The fallback is still there for a panel genuinely not displaying the contig —
// replacing its regions is the only way to reach the span at all.
test('a panel that cannot reach the span falls back to the locstring', () => {
  const panel = movablePanel({ reachable: false })
  moveMatePanels({
    stack: { views: [movablePanel(), panel] },
    anchorIndex: 0,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(panel.navToLocString).toHaveBeenCalledWith(
    'chr8_PATERNAL:1999001..2099000',
  )
})

// A panel the follow MOVES is re-asserted onto the anchor's mapping the moment
// it settles, and this navigation is what wakes that pass — so without taking
// the anchor the item ran, moved the neighbour, and the follow pulled it
// straight back. Anchoring the clicked panel is the item's own label: this one
// stays, the others come to it.
test('a following stack is anchored on the clicked panel', () => {
  const setFollowAnchorIndex = jest.fn()
  moveMatePanels({
    stack: {
      views: [movablePanel(), movablePanel(), movablePanel()],
      followSynteny: true,
      followAnchorIndex: 0,
      setFollowAnchorIndex,
    },
    anchorIndex: 2,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(setFollowAnchorIndex).toHaveBeenCalledWith(2)
})

// Two stacks that must not be written: one with the follow switched off, where
// the anchor is a persisted setting this click never touched, and one that has
// no follow at all (BreakpointSplitView).
test('a stack that is not following keeps its anchor', () => {
  const setFollowAnchorIndex = jest.fn()
  const args = {
    anchorIndex: 1,
    indexes: [0],
    feature: chainFeature(),
    region: window,
    session,
  }
  moveMatePanels({
    stack: {
      views: [movablePanel(), movablePanel()],
      followSynteny: false,
      followAnchorIndex: 0,
      setFollowAnchorIndex,
    },
    ...args,
  })
  moveMatePanels({
    stack: { views: [movablePanel(), movablePanel()] },
    ...args,
  })
  expect(setFollowAnchorIndex).not.toHaveBeenCalled()
})

// A CIGAR-less block names no region, so nothing is navigated — and nothing is
// anchored either, since the take is a state change a move that cannot happen
// has not earned.
test('a block with no answer moves nothing and anchors nothing', () => {
  const setFollowAnchorIndex = jest.fn()
  const panel = movablePanel()
  moveMatePanels({
    stack: {
      views: [movablePanel(), panel],
      followSynteny: true,
      followAnchorIndex: 1,
      setFollowAnchorIndex,
    },
    anchorIndex: 0,
    indexes: [1],
    feature: new SimpleFeature({
      uniqueId: 'nocigar',
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
    }),
    region: window,
    session,
  })
  expect(panel.navTo).not.toHaveBeenCalled()
  expect(setFollowAnchorIndex).not.toHaveBeenCalled()
})
