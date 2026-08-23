import { waitFor } from '@testing-library/react'

import { bandMoveTargets } from '../../../../plugins/linear-comparative-view/src/LinearSyntenyDisplay/bandMoveTargets.ts'
import { moveMatchingPanel } from '../../../../plugins/linear-comparative-view/src/LinearSyntenyDisplay/moveMatchingPanel.ts'
import { doBeforeEach, getTestSession, setup } from './util.tsx'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../../../../plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = { timeout: 30000 }
const ASM = 'volvox'

// The band's two move items navigate a row, and the follow's whole job is to
// navigate rows, so the two meet the same way the off-screen mate mark does:
// a row the follow MOVES is re-asserted onto the anchor's mapping the moment
// the anchor settles, so an item that navigates one without taking the anchor
// changes nothing and says it did — or, when the row it moves IS the anchor,
// drags every other row along with it. Both are the item doing something other
// than its own label.
//
// It needs the real thing, for the reason `LinearSyntenyOffscreenMateFollow`
// states: with no alignments there is nothing for a follow to re-assert, so a
// model-level test cannot see either failure. What it CAN see — the anchor
// index being written — is in `matePanelNavigation.test.ts`.

interface SyntenyView {
  initialized: boolean
  views: LinearGenomeViewModel[]
  followAnchorIndex: number
  levels: {
    level: number
    linearSyntenyDisplays: LinearSyntenyDisplayModel[]
  }[]
  setWidth: (n: number) => void
  setRowSyncMode: (mode: 'independent' | 'link' | 'follow') => void
}

// volvox_contig_swap.paf, volvox against itself: ctgA's first 6079 bases align
// to ctgB and ctgB's to ctgA. The swap is what makes a followed row's position
// measurable — with a 1:1 self-alignment the follow's answer for a row is the
// contig it is already on.
async function openSwapView() {
  const { session } = getTestSession()
  const added = session.addTrackConf({
    type: 'SyntenyTrack',
    trackId: 'volvox_contig_swap',
    name: 'volvox_contig_swap',
    assemblyNames: [ASM, ASM],
    adapter: {
      type: 'PAFAdapter',
      uri: 'volvox_contig_swap.paf',
      assemblyNames: [ASM, ASM],
    },
  }) as { trackId: string }
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: ASM }, { assembly: ASM }],
      tracks: [added.trackId],
    },
  }) as unknown as SyntenyView
  view.setWidth(800)
  await waitFor(() => {
    expect(view.initialized).toBe(true)
  }, timeout)
  await waitFor(() => {
    expect(view.levels[0]!.linearSyntenyDisplays[0]!.featureData).toBeDefined()
  }, timeout)
  return view
}

// Long enough to cover the coarse-blocks debounce the exact pass waits on, so
// an assertion after it is "the follow has had its say" rather than "it has not
// spoken yet".
function settle() {
  return new Promise(resolve => {
    setTimeout(resolve, 2000)
  })
}

// In bp, never `offsetPx`: a followed row's scale is not constant through a
// pan, so a pixel offset can move backwards over a step the row moved forwards
// through. `SyntenyFollow/CLAUDE.md` has the measurement.
function windowOf(lgv: LinearGenomeViewModel) {
  return Math.round(lgv.windowStartBp)
}

async function followingSwap() {
  const view = await openSwapView()
  const [row0, row1] = view.views
  await row0!.navToLocString('ctgB', ASM)
  await row1!.navToLocString('ctgA', ASM)
  view.setRowSyncMode('follow')
  await settle()
  expect(view.followAnchorIndex).toBe(0)
  return { view, row0: row0!, row1: row1! }
}

// The block this band draws, as the menu's own `feature` — row 0 is the query
// axis, so the one to right-click is whichever block runs off the contig row 0
// is showing.
function bandFeature(display: LinearSyntenyDisplayModel, refName: string) {
  const count = display.featureData?.featureIds.length ?? 0
  const feats: FeatPos[] = []
  for (let i = 0; i < count; i++) {
    const feat = display.getFeature(i)
    if (feat) {
      feats.push(feat)
    }
  }
  const found = feats.find(f => f.refName === refName)
  expect(found).toBeDefined()
  return found!
}

// "Move top panel" keeps the BOTTOM one, so under the follow it is asking for
// the leadership to change hands: row 1 becomes the row everything else is
// placed from. Without the take the anchor stayed on row 0 — the row the item
// was moving — so the follow went on leading from it and dragged row 1 along
// behind a click that said row 1 was staying put.
test('a band move hands the follow anchor to the panel that stays', async () => {
  const { view, row0, row1 } = await followingSwap()
  const display = view.levels[0]!.linearSyntenyDisplays[0]!
  const feat = bandFeature(display, 'ctgB')
  const target = bandMoveTargets({
    level: 0,
    topView: row0,
    bottomView: row1,
    feat,
    hasCigar: display.featureData?.hasCigar ?? false,
  }).find(t => t.label.includes('top panel'))
  expect(target).toBeDefined()

  await moveMatchingPanel({
    model: display,
    feat,
    window: target!.window,
    movingView: target!.movingView,
    stayingIndex: target!.stayingIndex,
    toMate: target!.toMate,
  })
  await settle()

  expect(view.followAnchorIndex).toBe(1)
}, 60000)

// ...and the anchor is not bookkeeping: it decides which row the next pan
// leads from. With the anchor left on row 0, panning row 0 moved row 1; with it
// handed to row 1, panning row 0 is a followed row drifting, which the exact
// pass pulls back while row 1 holds. This is the half a model-level test cannot
// reach, and the half that says the take was worth making.
test('...so the next pan is led by the panel that stayed', async () => {
  const { view, row0, row1 } = await followingSwap()
  const display = view.levels[0]!.linearSyntenyDisplays[0]!
  const feat = bandFeature(display, 'ctgB')
  const target = bandMoveTargets({
    level: 0,
    topView: row0,
    bottomView: row1,
    feat,
    hasCigar: display.featureData?.hasCigar ?? false,
  }).find(t => t.label.includes('top panel'))!

  await moveMatchingPanel({
    model: display,
    feat,
    window: target.window,
    movingView: target.movingView,
    stayingIndex: target.stayingIndex,
    toMate: target.toMate,
  })
  await settle()

  const held = windowOf(row1)
  await row0.navToLocString('ctgB:1000-2000', ASM)
  await settle()

  expect(windowOf(row1)).toBe(held)
}, 60000)
