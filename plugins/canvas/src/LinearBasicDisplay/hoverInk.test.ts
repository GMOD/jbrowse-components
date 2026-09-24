import { SimpleFeature } from '@jbrowse/core/util'

import { LITERAL } from '../RenderFeatureDataRPC/colorClasses.ts'
import { packRenderArrays } from '../RenderFeatureDataRPC/packRenderArrays.ts'
import {
  labelsMap,
  makeFeatureData,
  makeFlatbushItem,
  makeSubfeatureInfo,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment, rightClick } from './testEnv.ts'

import type { RectData } from '../RenderFeatureDataRPC/packRenderArrays.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

function rect(
  over: Partial<RectData> & Pick<RectData, 'start' | 'end' | 'y' | 'height'>,
): RectData {
  return {
    color: 0xff_80_40_ff,
    colorClass: LITERAL,
    strand: 0,
    flatbushIdx: 0,
    labelRowsAbove: 0,
    ...over,
  }
}

/**
 * One gene of two transcripts at bp 1000-2000, and a tall spacer whose rows
 * give the fixed-height display something to scroll. `GENE1` is baked 200px wide against a
 * 100px-wide gene, so the name overhangs its glyph the way the packer reserved.
 */
function geneData() {
  const rects = [
    rect({ start: 1000, end: 1500, y: 0, height: 10, childOrdinal: 0 }),
    rect({ start: 1600, end: 2000, y: 15, height: 10, childOrdinal: 1 }),
    rect({ start: 3000, end: 3200, y: 0, height: 300, flatbushIdx: 1 }),
  ]
  return makeFeatureData({
    ...packRenderArrays(rects, [], [], 0, Number.MAX_SAFE_INTEGER),
    flatbushItems: [
      makeFlatbushItem({
        featureId: 'g1',
        startBp: 1000,
        endBp: 2000,
        topPx: 0,
        bottomPx: 25,
        featureHeightPx: 25,
        name: 'GENE1',
      }),
      makeFlatbushItem({
        featureId: 'spacer',
        startBp: 3000,
        endBp: 3200,
        topPx: 0,
        bottomPx: 300,
        featureHeightPx: 300,
      }),
    ],
    subfeatureInfos: [
      makeSubfeatureInfo({
        featureId: 't0',
        parentFeatureId: 'g1',
        childOrdinal: 0,
        startBp: 1000,
        endBp: 1500,
        topPx: 0,
        bottomPx: 10,
      }),
      makeSubfeatureInfo({
        featureId: 't1',
        parentFeatureId: 'g1',
        childOrdinal: 1,
        startBp: 1600,
        endBp: 2000,
        topPx: 15,
        bottomPx: 25,
      }),
    ],
    floatingLabelsData: labelsMap({
      g1: {
        featureId: 'g1',
        minX: 1000,
        maxX: 2000,
        topY: 0,
        featureHeight: 25,
        nameLabel: { text: 'GENE1', relativeY: 0, textWidth: 200 },
      },
    }),
    labelKinds: { name: true, description: false, subfeature: false },
    featureCount: 2,
  })
}

// bpPerPx 10 over an 800px viewport starting at bp 0, so the gene's 1000-2000
// lands on 100-200 and every expectation below reads off that.
function setUp() {
  const { createDisplay } = createTestEnvironment()
  const { display, view, session } = createDisplay()
  display.setHeightMode('fixed')
  view.zoomTo(10)
  view.scrollTo(0)
  display.setRpcData(0, geneData(), ctgA)
  view.settleCoarseBlocks()
  return { display, view, session }
}

test("a hovered feature's box spans its glyph and the name overhanging it", () => {
  const { display } = setUp()
  expect(display.hoverInk).toEqual([])

  display.setHover('g1', undefined, ['GENE1'])

  // 100-200 is the glyph, 100-300 the name; 0-25 the two transcript rows, and
  // the name's row runs to 38.
  expect(display.hoverInk).toEqual([
    { left: 100, top: 0, width: 200, height: 38 },
  ])
})

test('a subfeature hover lights that transcript alone', () => {
  const { display } = setUp()

  display.setHover('g1', 't1', ['t1'])

  expect(display.hoverInk).toEqual([
    { left: 160, top: 15, width: 40, height: 10 },
  ])
})

// The chrome clips nothing, so a box taller than the canvas would paint over
// the track below; the scroll-locked layer this replaces clipped it.
test('a box taller than the canvas stops at its bottom edge', () => {
  const { display } = setUp()

  display.setHover('spacer', undefined, ['spacer'])

  // The packer puts the spacer's row under the gene's, at y 50, and its 300px
  // box runs well past the canvas.
  expect(display.renderState.canvasHeight).toBe(100)
  expect(display.hoverInk).toEqual([
    { left: 300, top: 50, width: 20, height: 50 },
  ])
})

test('a hovered feature scrolled off the canvas lights nothing', () => {
  const { display } = setUp()
  display.setHover('g1', undefined, ['GENE1'])
  expect(display.hoverInk).toHaveLength(1)

  display.setScrollTop(200)

  expect(display.scrollTop).toBe(200)
  expect(display.hoverInk).toEqual([])
})

// The box comes off `renderDataMap`, so it travels with a glyph still easing
// toward its row; taking the settled `laidOutDataMap` would park it on the
// destination and wait there.
test('the box follows the rows a Y morph is still moving', () => {
  const { display } = setUp()
  display.setHover('g1', undefined, ['GENE1'])

  display.beginYMorph(new Map([['g1', 40]]), 0)
  display.setMorphProgress(0)

  expect(display.hoverInk).toEqual([
    { left: 100, top: 40, width: 200, height: 38 },
  ])

  display.setMorphProgress(1)
  expect(display.hoverInk[0]!.top).toBe(0)
})

test("the open context menu's target stays lit with the hover cleared", () => {
  const { display } = setUp()
  const item = display.laidOutDataMap.get(0)!.flatbushItems[0]!

  rightClick(display, item)

  expect(display.hoveredFeature).toBeUndefined()
  expect(display.hoverInk).toEqual([
    { left: 100, top: 0, width: 200, height: 38 },
  ])
})

test('pinnedInk lights one box per pinned feature', () => {
  const { display } = setUp()
  expect(display.pinnedInk).toEqual([])

  display.setFeatureHighlights([
    { refName: 'ctgA', featureId: 'g1' },
    { refName: 'ctgA', featureId: 'spacer' },
  ])

  expect(display.pinnedInk).toEqual([
    { left: 100, top: 0, width: 200, height: 38 },
    { left: 300, top: 50, width: 20, height: 50 },
  ])
})

// A pin resolves off the fetched data, which reaches further than the regions
// the view shows; only the shown ones are walked for ink.
test('a pinned feature on another reference sequence lights nothing', () => {
  const { display } = setUp()
  display.setRpcData(
    1,
    makeFeatureData({
      ...packRenderArrays(
        [rect({ start: 1000, end: 2000, y: 0, height: 10 })],
        [],
        [],
        0,
        Number.MAX_SAFE_INTEGER,
      ),
      flatbushItems: [
        makeFlatbushItem({
          featureId: 'gB',
          startBp: 1000,
          endBp: 2000,
          topPx: 0,
          bottomPx: 10,
        }),
      ],
      featureCount: 1,
    }),
    { ...ctgA, refName: 'ctgB' },
  )

  display.setFeatureHighlights([{ refName: 'ctgB', featureId: 'gB' }])

  expect(display.highlightedFeatureIdSet.has('gB')).toBe(true)
  expect(display.pinnedInk).toEqual([])
})

// The dashed box says which features an unapplied solo has collected. Applying
// it leaves only those features on screen, which says it without a box.
test('soloInk lights the collection while the solo is pending, and drops it once applied', () => {
  const { display, view } = setUp()
  expect(display.soloInk).toEqual([])

  display.toggleSoloFeature('g1')

  expect(display.soloInk).toEqual([
    { left: 100, top: 0, width: 200, height: 38 },
  ])

  display.applySolo()
  // The solo is a fetch input, so the applied view is what the refetch brings
  // back: the box has to be gone once those features are all that is drawn.
  display.setRpcData(0, geneData(), ctgA)
  view.settleCoarseBlocks()

  expect(display.soloApplied).toBe(true)
  expect(display.soloInk).toEqual([])
})

test("selectionInk boxes the session's selected feature", () => {
  const { display, session } = setUp()
  expect(display.selectionInk).toEqual([])

  session.setSelection(
    new SimpleFeature({
      uniqueId: 'g1',
      refName: 'ctgA',
      start: 1000,
      end: 2000,
    }),
  )

  expect(display.selectedFeatureId).toBe('g1')
  expect(display.selectionInk).toEqual([
    { left: 100, top: 0, width: 200, height: 38 },
  ])
})
