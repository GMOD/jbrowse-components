import { SimpleFeature } from '@jbrowse/core/util'
import { takeSnackbarAction } from '@jbrowse/display-test-utils'
import { autorun } from 'mobx'

import { createDisplay, createDisplayWithSession } from './testEnv.ts'

// The lane genes and lane links are a SECOND fetch, dependent on the ortholog
// fetch that draws the placement boxes.
//
// The retry rule those two used to break is NOT here any more, and that is the
// point: the committed key was compared by hand in `prepare` with no `reload()`
// override to match, so Retry re-ran both bodies into the same decline forever.
// It is `installFetch`'s key gate now — the skeleton stamps the key at commit,
// owns the compare and the reload that overrides it — so what pins it is
// `installFetch.test.ts`, once, for every fetch rather than for this display.
// What is left here is what stays this display's own.

// A dependent fetch that holds `displayPhase` at `loading` for every refetch
// puts the striped scrim over lanes that are already drawn: the fetch is
// debounced 500ms and the overlay's anti-flash delay is 250ms, so the scrim
// always won that race on any pan that moved a quantized lane window. Before
// the first commit there is nothing on screen to flash over and a capture
// would shoot placement boxes, which is what the gate is for.
test('the lane fetch is part of loading only until it first lands', () => {
  const display = createDisplay()
  // the harness mounts no canvas; the paint half of loading is the mixin's
  display.markCanvasDrawn()
  expect(display.laneGenesFetchSpecs.specs.length).toBeGreaterThan(0)
  expect(display.displayPhase).toBe('loading')

  display.setLaneGenes(new Map(), display.laneGenesFetchSpecs.key, false)
  expect(display.displayPhase).toBe('ready')

  // the pan's refetch: the lanes are already drawn, and the phase says so
  display.setLaneGenes(new Map(), 'a-later-window', false)
  expect(display.displayPhase).toBe('ready')
})

// The anchor's gene spec exists before the ortholog fetch has framed a single
// mate, so the first commit can be the anchor alone; a phase reading `ready`
// off that one shot the primate amylase figure as placement boxes with every
// mate lane still downloading. The commit that counts is the first covering a
// mate lane, which the fetch states off its own spec list.
test('the first landing that counts is the one covering a mate lane', () => {
  const display = createDisplay()
  display.setLaneGenes(new Map(), 'volvox:ctgA:0-1000', false)
  expect(display.laneGenesCoverMates).toBe(false)
  display.setLaneGenes(
    new Map(),
    'volvox:ctgA:0-1000;volvox_random:ctgB:0-2048',
    true,
  )
  expect(display.laneGenesCoverMates).toBe(true)
  // covered once is covered: a later anchor-only refetch does not lower it
  display.setLaneGenes(new Map(), 'volvox:ctgA:500-1500', false)
  expect(display.laneGenesCoverMates).toBe(true)
})

// This display's `trackMenuItems` REPLACED the inherited list rather than
// appending to it. Nothing is lost by that today — `BaseDisplay` returns `[]`
// and neither mixin in the chain contributes a row — so this pins the item
// itself and the composition is hygiene against the chain growing one, which
// `addMenuItems` calls out as the silent half of writing an override by hand.
test('the stacked-synteny launcher is under Launch on the track menu, over the inherited rows', () => {
  const display = createDisplay()
  const items = display.trackMenuItems()

  // no lane-order row: the harness commits no features, so there is no mate
  // lane to order. `menus.test.ts` covers that one on its own
  expect(items.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Launch',
    undefined,
    'Color ribbons by',
    'Draw curved ribbons',
    'Bridge lanes that place nothing',
    'Show lane ticks',
  ])
  const [launch] = items
  const subMenu =
    launch && 'subMenu' in launch && typeof launch.subMenu !== 'function'
      ? launch.subMenu
      : []
  expect(subMenu.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Linear synteny view (visible region)',
  ])
})

// The two drawing settings were config-only, and a menu toggle that writes
// anywhere but the slot the getter reads is a checkbox that ticks and does
// nothing.
test('the drawing toggles write the slots the display reads back', () => {
  const display = createDisplay()
  expect(display.drawCurves).toBe(false)
  expect(display.showLaneTicks).toBe(true)

  display.setDrawCurves(true)
  display.setShowLaneTicks(false)
  expect(display.drawCurves).toBe(true)
  expect(display.showLaneTicks).toBe(false)
})

// `anchorSpans` is one of several producers of a ribbon endpoint pair, and the
// pair is ORDERED — the anchor's start first — not ascending. `ribbonPath`
// joins first end to first end, so sorting it here drew every
// anchor-to-lane-1 ribbon twisted where it should be straight (and straight
// where it should twist) on any reversed displayed region, which a `[rev]`
// locstring and a reversed panel of a synteny stack both produce.
describe('the anchor lane pair stays ordered', () => {
  function withGroup() {
    const display = createDisplay()
    display.setFeatures([
      new SimpleFeature({
        uniqueId: 'f1',
        name: 'gene1',
        refName: 'ctgA',
        start: 100,
        end: 300,
        strand: 1,
        mate: {
          assemblyName: 'volvox_random',
          refName: 'ctgB',
          start: 100,
          end: 300,
        },
      }),
    ])
    return display
  }

  function spanOf(display: ReturnType<typeof withGroup>) {
    const view = display.lgv
    const group = display.groups[0]!
    const { refName, start, end } = group.anchor
    const px = (coord: number) =>
      view.bpToPx({ refName, coord })!.offsetPx - view.offsetPx
    return {
      span: display.anchorSpans.get(group.key)!,
      atStart: px(start),
      atEnd: px(end),
    }
  }

  test('forward, the anchor start is the left end', () => {
    const { span, atStart, atEnd } = spanOf(withGroup())
    expect(span).toEqual([atStart, atEnd])
    expect(span[0]).toBeLessThan(span[1])
  })

  test('reversed, the anchor start is the RIGHT end', () => {
    const display = withGroup()
    display.lgv.setDisplayedRegions([
      {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
        reversed: true,
      },
    ])
    const { span, atStart, atEnd } = spanOf(display)
    expect(span).toEqual([atStart, atEnd])
    // the pair descends, and that descent is the orientation the ribbon draws
    expect(span[0]).toBeGreaterThan(span[1])
  })
})

// Re-anchoring replaces the hosting view's regions with another genome's, and
// what it discarded may be a region list built over several navigations, so
// the snackbar carries the same Undo the stacked view's moves offer.
test('re-anchoring offers an undo that puts the view back where it was', async () => {
  const { display, session } = createDisplayWithSession()
  const view = display.lgv
  const windowOf = () => ({
    regions: view.displayedRegions.map(r => ({ ...r })),
    start: view.windowStartBp,
    width: view.windowWidthBp,
  })
  const before = windowOf()
  display.reanchor('volvox', 'ctgA:1-100')
  for (let i = 0; i < 50 && !session.notifications.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(session.notifications.at(-1)?.message).toBe('Re-anchored on volvox')
  expect(windowOf()).not.toEqual(before)
  takeSnackbarAction(session, 'Undo')
  expect(windowOf()).toEqual(before)
})

// The clicked ribbon keeps an outline the way the pairwise view's does: the
// click records the hover's target, the passes compare it per instance, and
// only an empty-canvas click or a refetch lets it go.
test('a ribbon click keeps its outline id until empty canvas or a refetch', () => {
  const display = createDisplay()
  const feature = new SimpleFeature({
    uniqueId: 'f1',
    refName: 'ctgA',
    start: 100,
    end: 300,
  })
  display.setHoverTarget({ label: 'link', feature, targetIdx: 3 })
  display.selectHovered()
  expect(display.clickedFeatureId).toBe(4)
  expect(display.renderState.clickedFeatureId).toBe(4)

  // the pointer leaving does not release it
  display.setHoverTarget(undefined)
  expect(display.clickedFeatureId).toBe(4)

  // a stationary click on empty canvas does
  display.selectHovered()
  expect(display.clickedFeatureId).toBe(0)

  // and so does a refetch, whose targets the index no longer addresses
  display.setHoverTarget({ label: 'link', feature, targetIdx: 3 })
  display.selectHovered()
  display.setFeatures([])
  expect(display.clickedFeatureId).toBe(0)
})

// `session.selection` is global, so before the `ownFeatureIds` gate a
// selection in ANY track recomputed `laneGlyphCells` — the jexl color per
// glyph, every lane repacked, every cell re-uploaded — for a highlight this
// display would never draw. The gate resolves a foreign selection to the same
// undefined as no selection, which invalidates nothing downstream.
test('a selection in another track does not rebuild the lane glyph cells', () => {
  const { display, session } = createDisplayWithSession()
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'own1',
      name: 'gene1',
      refName: 'ctgA',
      start: 100,
      end: 300,
      strand: 1,
      mate: {
        assemblyName: 'volvox_random',
        refName: 'ctgB',
        start: 100,
        end: 300,
      },
    }),
  ])
  // keep the computed hot: outside a reaction it re-evaluates on every read
  // and identity says nothing
  const stop = autorun(() => display.laneGlyphCells)
  const before = display.laneGlyphCells
  session.setSelection(
    new SimpleFeature({
      uniqueId: 'some-other-tracks-feature',
      refName: 'ctgA',
      start: 0,
      end: 10,
    }),
  )
  expect(display.selectedFeatureId).toBeUndefined()
  expect(display.laneGlyphCells).toBe(before)

  // selecting one of its OWN features is the recompute the highlight needs
  session.setSelection(display.features![0]!)
  expect(display.selectedFeatureId).toBe('own1')
  expect(display.laneGlyphCells).not.toBe(before)
  stop()
})
