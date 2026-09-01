import { SimpleFeature } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import {
  containingPanelStack,
  matePanelIndexes,
  matePanelSpan,
  moveMatePanels,
} from './matePanelNavigation.ts'
import { createPanelStack } from './testEnv.ts'

import type { PanelStack } from './matePanelNavigation.ts'
import type { AbstractSessionModel, Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

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

// A panel, as much of one as the move touches, and a REAL node: `takeFollowAnchor`
// and `captureRowViewport` both guard on liveness, so a plain object throws on
// the two paths — the release and the Undo — most worth testing.
//
// `reachable` is whether `navTo` resolves, which stands for "the span is inside
// the regions this panel already displays". `landed` is `navToLocString`
// answering false: it resolves without navigating when the contig is not a
// refName here and the text search raises a picker instead.
const TestPanel = types
  .model('TestPanel', {
    reachable: types.optional(types.boolean, true),
    landed: types.optional(types.boolean, true),
  })
  .volatile(() => ({
    displayedRegions: [
      {
        refName: 'chr8_PATERNAL',
        start: 0,
        end: 10_000_000,
        assemblyName: 'hg002v1.2',
      },
    ] as Region[],
    windowWidthBp: 100_000,
    windowStartBp: 500_000,
    navToCalls: [] as unknown[],
    navToLocStringCalls: [] as string[],
  }))
  .actions(self => ({
    navTo(loc: unknown) {
      self.navToCalls.push(loc)
      if (!self.reachable) {
        throw new Error('not in displayed regions')
      }
    },
    navToLocString(loc: string) {
      self.navToLocStringCalls.push(loc)
      return Promise.resolve(self.landed)
    },
    setDisplayedRegions(regions: Region[]) {
      self.displayedRegions = regions
    },
    setWindow(widthBp: number, startBp: number) {
      self.windowWidthBp = widthBp
      self.windowStartBp = startBp
    },
  }))

type TestPanelModel = Instance<typeof TestPanel>

function movablePanel(opts: { reachable?: boolean; landed?: boolean } = {}) {
  return TestPanel.create(opts)
}

// The one cast these mocks need, in the two places that build a stack out of
// them: a `PanelStack` holds real `LinearGenomeViewModel`s, and standing up two
// dozen unread properties per panel to say so would hide what the move actually
// touches.
function asPanelStack<T>(stack: T) {
  return stack as T & PanelStack
}

// The follow state a stack carries, as its own node so `release` has something
// alive to write. `panels` is volatile because the panels are not real LGVs and
// a typed array would insist they were.
const TestStack = types
  .model('TestStack', {
    followSynteny: types.optional(types.boolean, true),
    followAnchorIndex: types.optional(types.number, 0),
  })
  .volatile(() => ({ views: [] as TestPanelModel[] }))
  .actions(self => ({
    setViews(views: TestPanelModel[]) {
      self.views = views
    },
    setFollowAnchorIndex(idx: number) {
      self.followAnchorIndex = idx
    },
    holdFollowAnchor<T>(fn: () => T) {
      return fn()
    },
  }))

function followingStack(
  views: TestPanelModel[],
  opts: { followSynteny?: boolean; followAnchorIndex?: number } = {},
) {
  const stack = TestStack.create(opts)
  stack.setViews(views)
  return asPanelStack(stack)
}

// The BreakpointSplitView shape: a stack with no follow at all, which is what
// `isFollowingStack` answers false for.
function plainStack(views: TestPanelModel[]) {
  return asPanelStack({ views })
}

const notify = jest.fn()
const notifyError = jest.fn()
const session = { notify, notifyError } as unknown as AbstractSessionModel

beforeEach(() => {
  notify.mockClear()
  notifyError.mockClear()
})

const window = { start: 2_000_000, end: 2_100_000 }

const noCigarFeature = () =>
  new SimpleFeature({
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
  })

// The single Undo the snackbar carries, or undefined when it offered none.
function undoAction() {
  const action = notify.mock.calls.at(-1)?.[2] as
    | { name: string; onClick: () => void }
    | undefined
  return action?.name === 'Undo' ? action : undefined
}

// `navToLocString` REPLACES `displayedRegions` with the single contig it lands
// on, and the synteny fetch keeps a block only when both ends are in view — so a
// whole-genome panel moved once was narrowed permanently, losing the ribbons the
// move exists to line up. `navTo` moves inside the regions the panel already
// has.
test('a panel that can reach the span is moved without replacing its regions', async () => {
  const panel = movablePanel()
  await moveMatePanels({
    stack: plainStack([movablePanel(), panel]),
    anchorIndex: 0,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(panel.navToCalls).toEqual([
    { refName: 'chr8_PATERNAL', start: 1_999_000, end: 2_099_000 },
  ])
  expect(panel.navToLocStringCalls).toEqual([])
})

// Nothing was discarded to get there and no anchor was taken, so there is
// nothing to put back — a snackbar here would be one on every move.
test('a move that stays inside the panel raises no snackbar', async () => {
  await moveMatePanels({
    stack: plainStack([movablePanel(), movablePanel()]),
    anchorIndex: 0,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(notify).not.toHaveBeenCalled()
})

// The fallback is still there for a panel genuinely not displaying the contig —
// replacing its regions is the only way to reach the span at all.
test('a panel that cannot reach the span falls back to the locstring', async () => {
  const panel = movablePanel({ reachable: false })
  await moveMatePanels({
    stack: plainStack([movablePanel(), panel]),
    anchorIndex: 0,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(panel.navToLocStringCalls).toEqual(['chr8_PATERNAL:1999001..2099000'])
})

// That fallback is the one branch that discards something: a region list the
// reader may have built over several navigations, which "show all regions" is
// not an undo for.
test('the region-replacing fallback offers an Undo that puts the regions back', async () => {
  const panel = movablePanel({ reachable: false })
  const before = panel.displayedRegions
  await moveMatePanels({
    stack: plainStack([movablePanel(), panel]),
    anchorIndex: 0,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  panel.setDisplayedRegions([
    {
      refName: 'chr8_PATERNAL',
      start: 0,
      end: 100,
      assemblyName: 'hg002v1.2',
    },
  ])
  panel.setWindow(1, 1)
  undoAction()!.onClick()
  expect(panel.displayedRegions).toEqual(before)
  expect([panel.windowWidthBp, panel.windowStartBp]).toEqual([100_000, 500_000])
})

// A panel the follow MOVES is re-asserted onto the anchor's mapping the moment
// it settles, and this navigation is what wakes that pass — so without taking
// the anchor the item ran, moved the neighbour, and the follow pulled it
// straight back. Anchoring the clicked panel is the item's own label: this one
// stays, the others come to it.
test('a following stack is anchored on the clicked panel', async () => {
  const stack = followingStack(
    [movablePanel(), movablePanel(), movablePanel()],
    { followAnchorIndex: 0 },
  )
  await moveMatePanels({
    stack,
    anchorIndex: 2,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(stack.followAnchorIndex).toBe(2)
  expect(undoAction()).toBeDefined()
})

// The take moved rows the click never named — the follow re-places every panel
// off the new anchor — so its Undo has to put the anchor back too, not just the
// panel that was navigated.
test('the Undo gives the follow anchor back', async () => {
  const stack = followingStack([movablePanel(), movablePanel()], {
    followAnchorIndex: 1,
  })
  await moveMatePanels({
    stack,
    anchorIndex: 0,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(stack.followAnchorIndex).toBe(0)
  undoAction()!.onClick()
  expect(stack.followAnchorIndex).toBe(1)
})

// Two stacks that must not be written: one with the follow switched off, where
// the anchor is a persisted setting this click never touched, and one that has
// no follow at all (BreakpointSplitView), which is what the type guard is for —
// with the three properties independently optional, the second one took an
// optional call and wrote nothing, which is indistinguishable from a bug.
test('a stack that is not following keeps its anchor', async () => {
  const args = {
    anchorIndex: 1,
    indexes: [0],
    feature: chainFeature(),
    region: window,
    session,
  }
  const stack = followingStack([movablePanel(), movablePanel()], {
    followSynteny: false,
    followAnchorIndex: 0,
  })
  await moveMatePanels({ stack, ...args })
  await moveMatePanels({
    stack: plainStack([movablePanel(), movablePanel()]),
    ...args,
  })
  expect(stack.followAnchorIndex).toBe(0)
})

// A CIGAR-less block names no region, so nothing is navigated — and nothing is
// anchored either, since the take is a state change a move that cannot happen
// has not earned.
test('a block with no answer moves nothing and anchors nothing', async () => {
  const panel = movablePanel()
  const stack = followingStack([movablePanel(), panel], {
    followAnchorIndex: 1,
  })
  await moveMatePanels({
    stack,
    anchorIndex: 0,
    indexes: [1],
    feature: noCigarFeature(),
    region: window,
    session,
  })
  expect(panel.navToCalls).toEqual([])
  expect(stack.followAnchorIndex).toBe(1)
})

// The take happens BEFORE the navigation, because the follow propagates away
// from the anchor and a panel moved while another holds it is pulled straight
// back. That makes it a state change the navigation has not earned yet: a
// contig the moving panel's assembly does not have fails both branches, and
// without the release the item reported an error and re-pointed the follow at a
// different panel anyway.
test('a navigation that throws gives the anchor back', async () => {
  const panel = movablePanel({ reachable: false })
  jest
    .spyOn(panel, 'navToLocString')
    .mockRejectedValue(new Error('unknown refName'))
  const stack = followingStack([movablePanel(), panel], {
    followAnchorIndex: 1,
  })
  await moveMatePanels({
    stack,
    anchorIndex: 0,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(notifyError).toHaveBeenCalled()
  expect(notify).not.toHaveBeenCalled()
  expect(stack.followAnchorIndex).toBe(1)
})

// `navToLocString` resolving false is the picker case — ordinary for a PAF
// naming contigs `1`,`2` against an assembly spelling them `chr1`,`chr2`.
// Counted as a move it left the anchor taken for a navigation that never
// happened, and posted a live Undo over a stack nothing had touched.
test('a navigation that resolves without moving gives the anchor back', async () => {
  const stack = followingStack(
    [movablePanel(), movablePanel({ reachable: false, landed: false })],
    { followAnchorIndex: 1 },
  )
  await moveMatePanels({
    stack,
    anchorIndex: 0,
    indexes: [1],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(notify).not.toHaveBeenCalled()
  expect(stack.followAnchorIndex).toBe(1)
})

// A self-alignment moves BOTH neighbours, and one of them failing must not
// decide for the other: the anchor is earned if either landed.
test('one neighbour failing does not release an anchor the other earned', async () => {
  const good = movablePanel()
  const bad = movablePanel({ reachable: false })
  jest.spyOn(bad, 'navToLocString').mockRejectedValue(new Error('nope'))
  const stack = followingStack([bad, movablePanel(), good], {
    followAnchorIndex: 0,
  })
  await moveMatePanels({
    stack,
    anchorIndex: 1,
    indexes: [0, 2],
    feature: chainFeature(),
    region: window,
    session,
  })
  expect(notifyError).toHaveBeenCalled()
  expect(good.navToCalls).toHaveLength(1)
  expect(stack.followAnchorIndex).toBe(1)
})
