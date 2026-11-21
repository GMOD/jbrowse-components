import { SimpleFeature } from '@jbrowse/core/util'

import { recordsByBlock } from '../../VariantRPC/executeVariantCellData.ts'
import { internGenotype } from '../../shared/genotypeCodec.ts'
import { placeVariantRows } from '../placeVariantRows.ts'
import { cellGlyphs } from './cellGlyphs.ts'
import { computeVariantCells } from './computeVariantCells.ts'
import { pickVariantCell } from './pickVariantCell.ts'
import {
  HIT_TOLERANCE_PX,
  computeVariantHitQuery,
  featuresNearCursor,
} from './variantHitTest.ts'

import type { PickCellData } from './pickVariantCell.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
} from './variantRenderingBackendTypes.ts'

interface Cell {
  feature: number
  row: number
}

// Cells in final (post-bucketing) order; features as [start, end] spans. The
// worker row is the lookup key; `screenRow` places it the way `rowRemap` does
// for the painted channels.
function build({
  refCells = [],
  altCells = [],
  features,
  screenRow = w => w,
}: {
  refCells?: Cell[]
  altCells?: Cell[]
  features: [number, number][]
  screenRow?: (workerRow: number) => number
}): PickCellData {
  const all = [...refCells, ...altCells]
  return {
    cellFeatureIndices: Uint32Array.from(all.map(c => c.feature)),
    cellWorkerRowIndices: Uint32Array.from(all.map(c => c.row)),
    numCells: all.length,
    refCellCount: refCells.length,
    cellPositions: Uint32Array.from(all.flatMap(c => features[c.feature]!)),
    cellRowIndices: Uint32Array.from(all.map(c => screenRow(c.row))),
    cellColors: new Uint32Array(all.length),
    cellShapeTypes: new Uint8Array(all.length),
  }
}

interface PaintedRecord {
  id: string
  start: number
  end: number
  // one genotype per row
  genotypes: string[]
}

// Records in fetch order, through the worker's own layout (`recordsByBlock`)
// and cell builder, placed on identity rows: the payload the display picks
// from. `indexOf` names a record's feature index in it.
function painted(records: PaintedRecord[], showReference = false) {
  const samples = records[0]!.genotypes.map((_, i) => `s${i}`)
  const genotypeDict: string[] = []
  const dictIndex = new Map<string, number>()
  const featureGenotypeCodes = new Map(
    records.map(({ id, genotypes }) => [
      id,
      Uint32Array.from(genotypes, gt =>
        internGenotype(gt, genotypeDict, dictIndex),
      ),
    ]),
  )
  const filteredVariants = recordsByBlock({
    layout: 'genomic',
    lookupRegions: [
      { refName: 'ctgA', start: 0, end: 800, displayedRegionIndex: 0 },
    ],
    filteredVariants: records.map(({ id, start, end }) => ({
      feature: new SimpleFeature({
        id,
        data: { refName: 'ctgA', start, end, REF: 'A', ALT: ['T'] },
      }),
      mostFrequentAlt: '1',
    })),
  }).get(0)!
  const cells = computeVariantCells({
    filteredVariants,
    sources: samples.map(name => ({ name, sampleName: name })),
    rowsField: 'sample',
    showReference,
    featureGenotypeCodes,
    genotypeDict,
    sampleNames: samples,
  })
  const data: PickCellData = {
    ...placeVariantRows(
      cells,
      Uint32Array.from(samples, (_, i) => i),
    ),
    ...cellGlyphs(cells),
  }
  return {
    data,
    featureIndexData: cells.featureIndexData,
    indexOf: (id: string) =>
      cells.featureInfo.findIndex(f => f.featureId === id),
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
  rowUnmap: identityRows,
}

describe('pickVariantCell candidate narrowing', () => {
  // A 400bp deletion with a 1bp SNP inside it, both called in row 0.
  const { data, featureIndexData, indexOf } = painted([
    { id: 'del', start: 100, end: 500, genotypes: ['0/1'] },
    { id: 'snp', start: 300, end: 301, genotypes: ['0/1'] },
  ])
  const del = indexOf('del')
  const snp = indexOf('snp')

  test('a SNP inside a deletion paints over it, so it picks from a click tolerance away', () => {
    for (const mouseX of [300, 302 + HIT_TOLERANCE_PX - 1]) {
      const picked = pickVariantCell({
        data,
        candidateFeatures: [del, snp],
        mouseX,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
        ...geom,
      })
      expect(picked?.featureIndex).toBe(snp)
    }
  })

  test('of two offset overlapping SVs the shorter, painted on top, wins whichever starts first', () => {
    const { data: offset, indexOf: offsetIndexOf } = painted([
      { id: 'shortFirst', start: 100, end: 500, genotypes: ['0/1'] },
      { id: 'longLater', start: 300, end: 900, genotypes: ['1/1'] },
    ])
    for (const candidateFeatures of [
      [0, 1],
      [1, 0],
    ]) {
      const picked = pickVariantCell({
        data: offset,
        candidateFeatures,
        mouseX: 400,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
        ...geom,
      })
      expect(picked?.featureIndex).toBe(offsetIndexOf('shortFirst'))
    }
    const pastShortEnd = pickVariantCell({
      data: offset,
      candidateFeatures: [0, 1],
      mouseX: 503,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...geom,
    })
    expect(pastShortEnd?.featureIndex).toBe(offsetIndexOf('longLater'))
  })

  test("a SNP at a deletion's last base picks from a tolerance inside the deletion", () => {
    // the SNP draws over [499, 501), past the deletion's ink, at the 2px floor
    const atEdge = painted([
      { id: 'del', start: 100, end: 500, genotypes: ['0/1'] },
      { id: 'snp', start: 499, end: 500, genotypes: ['0/1'] },
    ])
    const picked = pickVariantCell({
      data: atEdge.data,
      candidateFeatures: [0, 1],
      mouseX: 496,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...geom,
    })
    expect(picked?.featureIndex).toBe(atEdge.indexOf('snp'))
  })

  test('a no-call on a shorter record paints over an alt on a longer one, so it picks', () => {
    const { data: noCallOver, indexOf: noCallIndexOf } = painted([
      { id: 'cnv', start: 100, end: 500, genotypes: ['./.'] },
      { id: 'deletion', start: 300, end: 900, genotypes: ['0/1'] },
    ])
    const picked = pickVariantCell({
      data: noCallOver,
      candidateFeatures: [0, 1],
      mouseX: 400,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...geom,
    })
    expect(picked?.featureIndex).toBe(noCallIndexOf('cnv'))
  })

  test('a reference cell on a SNP paints under an alt on a deletion, so the deletion picks', () => {
    const { data: refUnder, indexOf: refUnderIndexOf } = painted(
      [
        { id: 'del', start: 100, end: 500, genotypes: ['0/1'] },
        { id: 'snp', start: 300, end: 301, genotypes: ['0/0'] },
      ],
      true,
    )
    const picked = pickVariantCell({
      data: refUnder,
      candidateFeatures: [0, 1],
      mouseX: 300,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...geom,
    })
    expect(picked?.featureIndex).toBe(refUnderIndexOf('del'))
  })

  test('between two records as short, the one painted on top', () => {
    // one site split into a record per allele: a 0/2 sample's ref cell on the
    // first record, painted under its alt cell on the second
    const split = build({
      refCells: [{ feature: 0, row: 0 }],
      altCells: [{ feature: 1, row: 0 }],
      features: [
        [300, 301],
        [300, 301],
      ],
    })
    for (const candidateFeatures of [
      [0, 1],
      [1, 0],
    ]) {
      const picked = pickVariantCell({
        data: split,
        candidateFeatures,
        mouseX: 300,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
        ...geom,
      })
      expect(picked?.featureIndex).toBe(1)
      expect(picked?.cellIndex).toBe(1)
    }
  })

  describe('neighbours that do not overlap', () => {
    // two SNPs a few px apart, each drawn at the 2px floor: A over [300, 302),
    // B over [305, 307), B later in paint order
    const neighbours = painted([
      { id: 'A', start: 300, end: 301, genotypes: ['0/1'] },
      { id: 'B', start: 305, end: 306, genotypes: ['0/1'] },
    ])
    const pickAt = (mouseX: number, pickBlock = block) =>
      pickVariantCell({
        ...geom,
        block: pickBlock,
        data: neighbours.data,
        candidateFeatures: [0, 1],
        mouseX,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
      })

    test('the pointer on one names it, not the neighbour a tolerance away', () => {
      expect(pickAt(300.5)?.featureIndex).toBe(neighbours.indexOf('A'))
      expect(pickAt(305.5)?.featureIndex).toBe(neighbours.indexOf('B'))
    })

    test('between them, the nearer one is named', () => {
      expect(pickAt(302.5)?.featureIndex).toBe(neighbours.indexOf('A'))
      expect(pickAt(304.5)?.featureIndex).toBe(neighbours.indexOf('B'))
    })

    test('on a reversed region, where A draws right of B', () => {
      // A over [498, 500), B over [493, 495)
      const flipped = { ...block, reversed: true }
      expect(pickAt(498.5, flipped)?.featureIndex).toBe(neighbours.indexOf('A'))
      expect(pickAt(494.5, flipped)?.featureIndex).toBe(neighbours.indexOf('B'))
    })

    test('a shorter record beside the one under the pointer does not take it', () => {
      // a 10bp deletion over [300, 310), a SNP after it over [312, 314)
      const beside = painted([
        { id: 'del', start: 300, end: 310, genotypes: ['0/1'] },
        { id: 'snp', start: 312, end: 313, genotypes: ['0/1'] },
      ])
      const picked = pickVariantCell({
        ...geom,
        data: beside.data,
        candidateFeatures: [0, 1],
        mouseX: 309.5,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
      })
      expect(picked?.featureIndex).toBe(beside.indexOf('del'))
    })

    test('a record as wide drawn partly over the one under the pointer does not take it', () => {
      // A over [300, 302), B over [301, 303): B covers A's right pixel only
      const touching = painted([
        { id: 'A', start: 300, end: 301, genotypes: ['0/1'] },
        { id: 'B', start: 301, end: 302, genotypes: ['0/1'] },
      ])
      const picked = pickVariantCell({
        ...geom,
        data: touching.data,
        candidateFeatures: [0, 1],
        mouseX: 300.5,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
      })
      expect(picked?.featureIndex).toBe(touching.indexOf('A'))
    })

    test('a later record drawn narrower by the pixel snap does not take the one under the pointer', () => {
      // at 2/3 bp per px two 3bp records snap to A over [456, 461) and B over
      // [458, 462)
      const snapped = painted([
        { id: 'A', start: 304, end: 307, genotypes: ['0/1'] },
        { id: 'B', start: 305, end: 308, genotypes: ['0/1'] },
      ])
      const picked = pickVariantCell({
        ...geom,
        block: { ...block, end: 400, screenEndPx: 600 },
        data: snapped.data,
        candidateFeatures: [0, 1],
        mouseX: 456.5,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
      })
      expect(picked?.featureIndex).toBe(snapped.indexOf('A'))
    })

    test('the pointer on a pixel edge names the cell whose pixel it is in', () => {
      // reversed at 0.5 bp per px: A over [198, 200), B abutting over [196, 198)
      const abutting = painted([
        { id: 'A', start: 300, end: 301, genotypes: ['0/1'] },
        { id: 'B', start: 301, end: 302, genotypes: ['0/1'] },
      ])
      const picked = pickVariantCell({
        ...geom,
        block: { ...block, end: 400, reversed: true },
        data: abutting.data,
        candidateFeatures: [0, 1],
        mouseX: 198,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
      })
      expect(picked?.featureIndex).toBe(abutting.indexOf('A'))
    })
  })

  test('candidate order does not change the pick', () => {
    const reversed = pickVariantCell({
      data,
      candidateFeatures: [snp, del],
      mouseX: 300,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...geom,
    })
    expect(reversed?.featureIndex).toBe(snp)
  })

  test('rejects a candidate the cursor is not actually over', () => {
    // A candidate is any feature in the padded bp window, so the SNP at 300
    // can be one with the cursor at 150 — it has to be filtered back out,
    // leaving the deletion.
    const picked = pickVariantCell({
      data,
      candidateFeatures: [del, snp],
      mouseX: 150,
      mouseY: rowY(0),
      rowNearest: 0,
      rowLowest: 0,
      ...geom,
    })
    expect(picked?.featureIndex).toBe(del)
  })

  test('the click tolerance reaches the pixels whose centres lie within it', () => {
    const atX = (mouseX: number) =>
      pickVariantCell({
        data,
        candidateFeatures: [snp],
        mouseX,
        mouseY: rowY(0),
        rowNearest: 0,
        rowLowest: 0,
        ...geom,
      })
    // The 1bp SNP draws at the 2px floor, so its extent is [300, 302): five
    // pixels reach it on either side.
    const drawnRight = 302
    expect(atX(300 - HIT_TOLERANCE_PX)).toBeDefined()
    expect(atX(300 - HIT_TOLERANCE_PX - 1)).toBeUndefined()
    expect(atX(drawnRight + HIT_TOLERANCE_PX - 1)).toBeDefined()
    expect(atX(drawnRight + HIT_TOLERANCE_PX)).toBeUndefined()
  })

  test('the bp window reaches a click tolerance past the drawn edge', () => {
    // the SNP's span [300, 301) draws over [300, 302) at the 2px floor, inside
    // the deletion every window here also finds
    const atX = (mouseX: number) => {
      const query = computeVariantHitQuery(block, mouseX, rowY(0), 0, 10, 1)
      return pickVariantCell({
        data,
        candidateFeatures: featuresNearCursor(featureIndexData, query),
        mouseX,
        mouseY: rowY(0),
        rowNearest: query.rowNearest,
        rowLowest: query.rowLowest,
        ...geom,
      })
    }
    expect(atX(302 + HIT_TOLERANCE_PX - 1)?.featureIndex).toBe(snp)
    expect(atX(300 - HIT_TOLERANCE_PX)?.featureIndex).toBe(snp)
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
    altCells: [{ feature: 0, row: 2 }],
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

  // Half-pixel rows: a cell draws taller than its row, so several rows cover
  // the cursor's pixel. Each band is the one the hit query derives.
  const subPixel = { ...geom, state: { ...state, rowHeight: 0.5 } }
  const bandAt = (mouseY: number) => {
    const { rowNearest, rowLowest } = computeVariantHitQuery(
      block,
      100,
      mouseY,
      0,
      subPixel.state.rowHeight,
      1,
    )
    return { mouseY, rowNearest, rowLowest }
  }
  const pixelOne = bandAt(1.2)

  test('sub-pixel rows: rows 0..2 all cover the second pixel', () => {
    expect(pixelOne).toMatchObject({ rowLowest: 0, rowNearest: 2 })
  })

  test('sub-pixel rows: the occupied row painted last in the band wins', () => {
    // Row 2's alt cell paints after row 0's reference cell, so it reports.
    const picked = pickVariantCell({
      data,
      candidateFeatures: [0],
      mouseX: 100,
      ...pixelOne,
      ...subPixel,
    })
    expect(picked?.rowIndex).toBe(2)
  })

  test('sub-pixel rows: an alt cell on a lower row paints over the nearest row', () => {
    // reference on the nearest row, the alt two rows up, both on the cursor's
    // pixel: the alt bucket paints after the reference one, so it is on top
    const altBelow = build({
      refCells: [{ feature: 0, row: 2 }],
      altCells: [{ feature: 0, row: 0 }],
      features: [[100, 101]],
    })
    const picked = pickVariantCell({
      data: altBelow,
      candidateFeatures: [0],
      mouseX: 100,
      ...pixelOne,
      ...subPixel,
    })
    expect(picked?.rowIndex).toBe(0)
    expect(picked?.cellIndex).toBe(1)
  })

  test('sub-pixel rows: an alt on a deletion covers a reference cell on a SNP in the band', () => {
    const { data: refUnder, indexOf } = painted(
      [
        { id: 'del', start: 50, end: 500, genotypes: ['0/0', '0/0', '0/1'] },
        { id: 'snp', start: 100, end: 101, genotypes: ['0/0', '0/0', '0/0'] },
      ],
      true,
    )
    const picked = pickVariantCell({
      data: refUnder,
      candidateFeatures: [0, 1],
      mouseX: 100,
      ...pixelOne,
      ...subPixel,
    })
    expect(picked?.featureIndex).toBe(indexOf('del'))
    expect(picked?.rowIndex).toBe(2)
  })

  test('sub-pixel rows: walks down the band when the nearest row is empty', () => {
    // Rows 1 and 2 have no cell, so the band continues to row 0 rather than
    // giving up.
    const rowZeroOnly = build({
      refCells: [{ feature: 0, row: 0 }],
      features: [[100, 101]],
    })
    const picked = pickVariantCell({
      data: rowZeroOnly,
      candidateFeatures: [0],
      mouseX: 100,
      ...pixelOne,
      ...subPixel,
    })
    expect(picked?.rowIndex).toBe(0)
    expect(picked?.cellIndex).toBe(0)
  })
})

describe('pickVariantCell insertions', () => {
  // An insertion of any length occupies 1bp of reference, and draws and picks
  // at that span like every other record.
  const data = build({
    altCells: [{ feature: 0, row: 0 }],
    features: [[1000, 1001]],
  })
  const zoomedOut = { ...geom, block: { ...block, end: 4000 } }
  // 1000bp -> x 200
  const pick = (mouseX: number, row: number) =>
    pickVariantCell({
      data,
      candidateFeatures: [0],
      mouseX,
      mouseY: rowY(row),
      rowNearest: row,
      rowLowest: row,
      ...zoomedOut,
    })

  test('a cursor past the click tolerance of the span picks nothing', () => {
    expect(pick(200, 0)).toBeDefined()
    expect(pick(200 + HIT_TOLERANCE_PX + 4, 0)).toBeUndefined()
  })
})

describe('pickVariantCell reversed regions', () => {
  test('a flipped bp->px mapping still resolves the span', () => {
    const data = build({
      altCells: [{ feature: 0, row: 0 }],
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
    expect(picked?.featureIndex).toBe(0)
  })
})

describe('pickVariantCell row placement', () => {
  // Worker rows 0 and 1, drawn in the opposite order — what any reorder,
  // regroup or clustering run produces now that row order no longer travels
  // with the fetch.
  const data = build({
    altCells: [
      { feature: 0, row: 0 },
      { feature: 1, row: 1 },
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
