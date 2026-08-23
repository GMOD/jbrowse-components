import { bandMoveTargets } from './bandMoveTargets.ts'

import type { FeatPos } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// A panel, as much of one as the decision reads: what it is currently SHOWING.
// Not the same question as what it could show — a ribbon is painted out to the
// overdraw band, so a panel can have the alignment's contig in its displayed
// regions and still be scrolled off it.
function panel(
  ...blocks: { refName: string; start: number; end: number }[]
): LinearGenomeViewModel {
  return {
    dynamicBlocks: { contentBlocks: blocks },
  } as unknown as LinearGenomeViewModel
}

const feat: FeatPos = {
  id: 'f1',
  name: 'f1',
  strand: 1,
  refName: 'chr8_MATERNAL',
  start: 0,
  end: 10_000_000,
  assemblyName: 'hg002mat',
  mate: {
    start: 0,
    end: 9_999_000,
    refName: 'chr8_PATERNAL',
    assemblyName: 'hg002pat',
  },
  attributes: {},
}

const onQuery = panel({ refName: 'chr8_MATERNAL', start: 2e6, end: 2.1e6 })
const onMate = panel({ refName: 'chr8_PATERNAL', start: 2e6, end: 2.1e6 })
const elsewhere = panel({ refName: 'chr1', start: 0, end: 1e6 })

// Level 1 throughout, so the staying index this reports cannot be read off the
// toMate flag alone: the band between views[1] and views[2] stays on 2 when the
// top panel moves and on 1 when the bottom one does.
const targets = (
  topView: LinearGenomeViewModel | undefined,
  bottomView: LinearGenomeViewModel | undefined,
  hasCigar = true,
) => bandMoveTargets({ level: 1, topView, bottomView, feat, hasCigar })

test('both panels showing the alignment get both items, top first', () => {
  // top first, matching the rows on screen and the order the user guide names
  expect(targets(onQuery, onMate).map(t => t.label)).toEqual([
    'Move top panel to the matching region',
    'Move bottom panel to the matching region',
  ])
})

test('each item moves the panel it names and reads the other one window', () => {
  const [top, bottom] = targets(onQuery, onMate)
  // moving the TOP means the BOTTOM stays, so the window is the mate axis
  expect(top!.movingView).toBe(onQuery)
  expect(top!.toMate).toBe(false)
  expect(top!.window).toEqual({ start: 2e6, end: 2.1e6 })
  expect(bottom!.movingView).toBe(onMate)
  expect(bottom!.toMate).toBe(true)
})

// The block says nothing about the correspondence inside it, so there is no
// matching region to resolve — a PIF's coarse tier, a minimap2 PAF without -c,
// MashMap, MCScan.
test('no CIGAR in the fetch, no items', () => {
  expect(targets(onQuery, onMate, false)).toEqual([])
})

// The bug this file exists for. A ribbon is drawn out to the overdraw band,
// which at whole-genome zoom spans many contigs, so a panel can be scrolled to
// a different contig with the ribbon still painted. The item used to be offered
// anyway and the move returned silently — a menu item that did nothing, in the
// one situation the item exists for, which is panels that have drifted apart.
test('a panel scrolled off the alignment is not offered as the one that stays', () => {
  // the bottom panel is elsewhere, so only IT can be moved: moving the top
  // would mean reading a window off a panel that has none
  expect(targets(onQuery, elsewhere).map(t => t.label)).toEqual([
    'Move bottom panel to the matching region',
  ])
  expect(targets(elsewhere, onMate).map(t => t.label)).toEqual([
    'Move top panel to the matching region',
  ])
})

test('neither panel showing it, no items', () => {
  expect(targets(elsewhere, elsewhere)).toEqual([])
})

test('a level whose second row does not exist yet offers nothing', () => {
  expect(targets(onQuery, undefined)).toEqual([])
  expect(targets(undefined, onMate)).toEqual([])
})

// The union of that contig's blocks, so a contig split across a padding block
// still yields the whole visible stretch rather than one piece of it.
test('a contig split across blocks yields its whole visible stretch', () => {
  const split = panel(
    { refName: 'chr8_PATERNAL', start: 2e6, end: 2.05e6 },
    { refName: 'chr1', start: 0, end: 1e6 },
    { refName: 'chr8_PATERNAL', start: 2.06e6, end: 2.1e6 },
  )
  expect(targets(onQuery, split)[0]!.window).toEqual({
    start: 2e6,
    end: 2.1e6,
  })
})

// The panel that STAYS is where the move points the follow's anchor, and the
// item's whole promise is that this panel does not move — so without the take,
// "move the top panel" was undone by the follow and "move the bottom panel"
// dragged the top one along. Named by position rather than re-derived from
// `toMate` at the call site, which is the second spelling that would drift.
test('each item names the panel that stays by its position in the stack', () => {
  expect(targets(onQuery, onMate).map(t => [t.label, t.stayingIndex])).toEqual([
    ['Move top panel to the matching region', 2],
    ['Move bottom panel to the matching region', 1],
  ])
})
