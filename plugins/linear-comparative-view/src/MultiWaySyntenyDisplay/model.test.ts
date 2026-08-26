import { SimpleFeature } from '@jbrowse/core/util'

import { createDisplay } from './testEnv.ts'

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

  display.setLaneGenes(new Map(), display.laneGenesFetchSpecs.key)
  expect(display.displayPhase).toBe('ready')

  // the pan's refetch: the lanes are already drawn, and the phase says so
  display.setLaneGenes(new Map(), 'a-later-window')
  expect(display.displayPhase).toBe('ready')
})

// This display's `trackMenuItems` REPLACED the inherited list rather than
// appending to it. Nothing is lost by that today — `BaseDisplay` returns `[]`
// and neither mixin in the chain contributes a row — so this pins the item
// itself and the composition is hygiene against the chain growing one, which
// `addMenuItems` calls out as the silent half of writing an override by hand.
test('the stacked-synteny launcher is on the track menu, over the inherited rows', () => {
  const display = createDisplay()
  const items = display.trackMenuItems()

  // no lane-order row: the harness commits no features, so there is no mate
  // lane to order. `menus.test.ts` covers that one on its own
  expect(items.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Launch stacked synteny view (visible region)',
    undefined,
    'Color ribbons by',
    'Draw curved ribbons',
    'Bridge lanes that place nothing',
    'Show lane ticks',
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
