import { pickVariantCell } from './pickVariantCell.ts'
import { HIT_TOLERANCE_PX } from './variantHitTest.ts'

import type { PickCellData } from './pickVariantCell.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
} from './variantRenderingBackendTypes.ts'

interface Cell {
  feature: number
  row: number
  carriesAlt?: boolean
}

// Cells in final (post-bucketing) order; features as [start, end] spans. The
// worker row is the lookup key; `screenRow` places it the way `rowRemap` does
// for the painted channels.
function build({
  refCells = [],
  altCells = [],
  features,
  insertedBp,
  screenRow = w => w,
}: {
  refCells?: Cell[]
  altCells?: Cell[]
  features: [number, number][]
  insertedBp?: number[]
  screenRow?: (workerRow: number) => number
}): PickCellData {
  const all = [...refCells, ...altCells]
  return {
    cellFeatureIndices: Uint32Array.from(all.map(c => c.feature)),
    cellWorkerRowIndices: Uint32Array.from(all.map(c => c.row)),
    cellAltDosage: Uint8Array.from(all.map(c => (c.carriesAlt ? 1 : 0))),
    numCells: all.length,
    refCellCount: refCells.length,
    featurePositions: Uint32Array.from(features.flat()),
    featureInsertedBp: Int32Array.from(insertedBp ?? features.map(() => 0)),
    cellPositions: Uint32Array.from(all.flatMap(c => features[c.feature]!)),
    cellRowIndices: Uint32Array.from(all.map(c => screenRow(c.row))),
    cellColors: new Uint32Array(all.length),
    cellShapeTypes: new Uint8Array(all.length),
  }
}

// Screen row n is worker row n — the arrangement every test here but the
// placement ones below is about something other than.
const identityRows = Int32Array.from({ length: 64 }, (_, i) => i)

// 1 bp per px, region anchored at 0, forward orientation.
const block: VariantRenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 800,
  screenStartPx: 0,
  screenEndPx: 800,
  reversed: false,
}

// An even canvas width, so the shader's canvas-centred snap leaves whole-pixel
// bp positions where they are and these cases stay about the pick, not about
// the grid.
const state: VariantRenderState = {
  canvasWidth: 800,
  canvasHeight: 600,
  rowHeight: 10,
  scrollTop: 0,
}

const rowY = (row: number) => row * state.rowHeight + state.rowHeight / 2

const geom = {
  block,
  state,
  pxPerBp: 1,
  insertionsWiden: true,
  rowUnmap: identityRows,
}

describe('pickVariantCell candidate narrowing', () => {
  // A 400bp deletion with a 1bp SNP inside it, both called in row 0.
  const data = build({
    altCells: [
      { feature: 0, row: 0, carriesAlt: true },
      { feature: 1, row: 0, carriesAlt: true },
    ],
    features: [
      [100, 500],
      [300, 301],
    ],
  })

  test('prefers the shortest feature so a SNP inside a deletion stays selectable', () => {
    const picked = pickVariantCell({
      data,
      candidateFeatures: [0, 1],
      mouseX: 300,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...geom,
    })
    expect(picked?.featureIndex).toBe(1)
    expect(picked?.genomicStart).toBe(300)
  })

  test('candidate order does not change the pick', () => {
    const reversed = pickVariantCell({
      data,
      candidateFeatures: [1, 0],
      mouseX: 300,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...geom,
    })
    expect(reversed?.featureIndex).toBe(1)
  })

  test('rejects a candidate the cursor is not actually over', () => {
    // The bp window is padded out to the widest insertion marker, so the SNP at
    // 300 is returned by the index even with the cursor at 150 — it has to be
    // filtered back out, leaving the deletion.
    const picked = pickVariantCell({
      data,
      candidateFeatures: [0, 1],
      mouseX: 150,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...geom,
    })
    expect(picked?.featureIndex).toBe(0)
  })

  test('the click tolerance extends exactly one tolerance past the drawn edge', () => {
    const atX = (mouseX: number) =>
      pickVariantCell({
        data,
        candidateFeatures: [1],
        mouseX,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
        ...geom,
      })
    // The 1bp SNP draws at the 2px floor, so its extent is [300, 302).
    const drawnRight = 302
    expect(atX(300 - HIT_TOLERANCE_PX)).toBeDefined()
    expect(atX(300 - HIT_TOLERANCE_PX - 1)).toBeUndefined()
    expect(atX(drawnRight + HIT_TOLERANCE_PX)).toBeDefined()
    expect(atX(drawnRight + HIT_TOLERANCE_PX + 1)).toBeUndefined()
  })

  test('returns undefined when nothing is under the cursor', () => {
    expect(
      pickVariantCell({
        data,
        candidateFeatures: [],
        mouseX: 300,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
        ...geom,
      }),
    ).toBeUndefined()
  })
})

describe('pickVariantCell row resolution', () => {
  // One site, four samples; only rows 0 and 2 have cells.
  const data = build({
    refCells: [{ feature: 0, row: 0 }],
    altCells: [{ feature: 0, row: 2, carriesAlt: true }],
    features: [[100, 101]],
  })

  test('reports the row the cursor is in, not whichever cell exists', () => {
    const picked = pickVariantCell({
      data,
      candidateFeatures: [0],
      mouseX: 100,
      mouseY: rowY(2),
      rowNearest: 2,
      rowLowest: 2,
      ...geom,
    })
    expect(picked?.rowIndex).toBe(2)
    expect(picked?.cellIndex).toBe(1)
  })

  test('an empty row under the cursor reports nothing rather than a neighbour', () => {
    expect(
      pickVariantCell({
        data,
        candidateFeatures: [0],
        mouseX: 100,
        mouseY: rowY(1),
        rowNearest: 1,
        rowLowest: 1,
        ...geom,
      }),
    ).toBeUndefined()
  })

  // Half-pixel rows under the 2px floor, so rows 0..2 all draw over the
  // cursor pixel.
  const subPixel = { ...geom, state: { ...state, rowHeight: 0.5 } }

  test('sub-pixel rows: the nearest occupied row in the band wins', () => {
    // Row 2 is nearest (and painted last), so it reports — not row 0, which a
    // spatial index might return first.
    const picked = pickVariantCell({
      data,
      candidateFeatures: [0],
      mouseX: 100,
      mouseY: 1.2,
      rowNearest: 2,
      rowLowest: 0,
      ...subPixel,
    })
    expect(picked?.rowIndex).toBe(2)
  })

  test('sub-pixel rows: walks down the band when the nearest row is empty', () => {
    // Row 1 has no cell, so the band continues to row 0 rather than giving up.
    const picked = pickVariantCell({
      data,
      candidateFeatures: [0],
      mouseX: 100,
      mouseY: 0.7,
      rowNearest: 1,
      rowLowest: 0,
      ...subPixel,
    })
    expect(picked?.rowIndex).toBe(0)
    expect(picked?.cellIndex).toBe(0)
  })
})

describe('pickVariantCell insertion markers', () => {
  // A 5000bp insertion occupying 1bp of reference: row 0 carries it, row 1 is
  // reference. Zoomed out to 0.2 px/bp the drawn marker is far wider than the
  // 2px cell, and only the alt row paints one.
  const data = build({
    refCells: [{ feature: 0, row: 1 }],
    altCells: [{ feature: 0, row: 0, carriesAlt: true }],
    features: [[1000, 1001]],
    insertedBp: [5000],
  })
  const zoomedOut = {
    ...geom,
    block: { ...block, end: 4000 },
    pxPerBp: 0.2,
  }
  // 1000bp -> x 200; the marker is centered there.
  const farFromLocus = 200 + HIT_TOLERANCE_PX + 4

  test('the alt row is hoverable across the whole drawn marker', () => {
    const picked = pickVariantCell({
      data,
      candidateFeatures: [0],
      mouseX: farFromLocus,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...zoomedOut,
    })
    expect(picked?.rowIndex).toBe(0)
    expect(picked?.insertedBp).toBe(5000)
  })

  test('the reference row of the same record is not widened', () => {
    // It paints no marker, so its hit target stays the 2px cell — otherwise
    // hovering empty space would claim that haplotype carries the insertion.
    expect(
      pickVariantCell({
        data,
        candidateFeatures: [0],
        mouseX: farFromLocus,
        mouseY: rowY(1),
        rowNearest: 1,
        rowLowest: 1,
        ...zoomedOut,
      }),
    ).toBeUndefined()
    const onLocus = pickVariantCell({
      data,
      candidateFeatures: [0],
      mouseX: 200,
      mouseY: rowY(1),
      rowNearest: 1,
      rowLowest: 1,
      ...zoomedOut,
    })
    expect(onLocus?.rowIndex).toBe(1)
    expect(onLocus?.insertedBp).toBe(0)
  })

  // With `showInsertionGlyphs` off the record is painted at the 2px floor like
  // a SNP and no marker is drawn, so the click target has to shrink with it.
  // It did not: the pick still measured the marker's box, and a click 20px
  // clear of a 2px cell opened that cell's feature widget.
  test('the drawn marker is not clickable when the display draws none', () => {
    const noGlyphs = { ...zoomedOut, insertionsWiden: false }
    expect(
      pickVariantCell({
        data,
        candidateFeatures: [0],
        mouseX: farFromLocus,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
        ...noGlyphs,
      }),
    ).toBeUndefined()
    // the 2px cell itself still is
    expect(
      pickVariantCell({
        data,
        candidateFeatures: [0],
        mouseX: 200,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
        ...noGlyphs,
      })?.rowIndex,
    ).toBe(0)
  })
})

describe('pickVariantCell reversed regions', () => {
  test('a flipped bp->px mapping still resolves the span', () => {
    const data = build({
      altCells: [{ feature: 0, row: 0, carriesAlt: true }],
      features: [[100, 300]],
    })
    // Reversed: higher bp maps to lower px, so toX(start) > toX(end).
    const picked = pickVariantCell({
      ...geom,
      block: { ...block, start: 200, end: 1000, reversed: true },
      data,
      candidateFeatures: [0],
      mouseX: 750,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
    })
    expect(picked?.genomicStart).toBe(100)
    expect(picked?.genomicEnd).toBe(300)
  })
})

describe('pickVariantCell row placement', () => {
  // Worker rows 0 and 1, drawn in the opposite order — what any reorder,
  // regroup or clustering run produces now that row order no longer travels
  // with the fetch.
  const data = build({
    altCells: [
      { feature: 0, row: 0, carriesAlt: true },
      { feature: 1, row: 1, carriesAlt: true },
    ],
    features: [
      [100, 200],
      [100, 200],
    ],
    screenRow: w => 1 - w,
  })
  // screen 0 <- worker 1, screen 1 <- worker 0
  const swapped = Int32Array.from([1, 0])

  test('resolves the cursor row through the placement, not positionally', () => {
    const top = pickVariantCell({
      ...geom,
      data,
      candidateFeatures: [0, 1],
      mouseX: 150,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      rowUnmap: swapped,
    })
    // the row drawn at the top is worker row 1, whose only cell is feature 1
    expect(top?.featureIndex).toBe(1)
    // and it reports the SCREEN row, so the highlight and `sources` lookup land
    // on the row the cursor is actually over
    expect(top?.rowIndex).toBe(0)

    const bottom = pickVariantCell({
      ...geom,
      data,
      candidateFeatures: [0, 1],
      mouseX: 150,
      mouseY: rowY(1),
      rowNearest: 1,
      rowLowest: 1,
      rowUnmap: swapped,
    })
    expect(bottom?.featureIndex).toBe(0)
    expect(bottom?.rowIndex).toBe(1)
  })

  test('a screen row the fetched data has no cells for picks nothing', () => {
    expect(
      pickVariantCell({
        ...geom,
        data,
        candidateFeatures: [0, 1],
        mouseX: 150,
        mouseY: rowY(2),
        rowNearest: 2,
        rowLowest: 2,
        // a sample the layout draws but this window's genotypes never mention
        rowUnmap: Int32Array.from([1, 0, -1]),
      }),
    ).toBeUndefined()
  })
})
