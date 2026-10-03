import { coverageLayout } from '@jbrowse/alignments-core'
import { setAbgrFill } from '@jbrowse/core/util/colorBits'

import { HIDDEN_ROW, REFERENCE_COLOR } from './constants.ts'
import {
  CELL_ALT,
  CELL_ALT_SECONDARY,
  CELL_NO_CALL,
  CELL_REF,
  CELL_UNPHASED,
} from './variantCellStyles.ts'
import { GENOTYPE_CLASS_LABELS } from './variantLegend.ts'
import { getCachedABGR } from './variantWebglUtils.ts'

/**
 * Each column's share of the drawn rows by what its cells paint, bottom to top:
 * carriers from the baseline, then the reference remainder, then the missing
 * classes hanging from the top edge. Segment `s` of column `c` lies in
 * `[segmentStart[c], segmentStart[c + 1])`, and a column's counts sum to
 * `drawnRows`.
 */
export interface FrequencyColumns {
  numColumns: number
  drawnRows: number
  segmentStart: Uint32Array
  segmentCount: Uint32Array
  segmentColor: Uint32Array
  segmentCategory: Uint8Array
  segmentDosage: Uint8Array
}

export interface FrequencyCells {
  numCells: number
  refCellCount: number
  // screen rows, `HIDDEN_ROW` where the display draws none
  cellRowIndices: Uint32Array
  cellFeatureIndices: ArrayLike<number>
  cellColors: Uint32Array
  cellAltDosage: Uint8Array
  cellCategories: Uint8Array
}

const BOTTOM_UP_RANK: Record<number, number> = {
  [CELL_ALT]: 0,
  [CELL_ALT_SECONDARY]: 1,
  [CELL_REF]: 2,
  [CELL_UNPHASED]: 3,
  [CELL_NO_CALL]: 4,
}

export function isCarrier(category: number) {
  return category === CELL_ALT || category === CELL_ALT_SECONDARY
}

interface Group {
  category: number
  dosage: number
  color: number
  count: number
}

function bottomUp(a: Group, b: Group) {
  return (
    BOTTOM_UP_RANK[a.category]! - BOTTOM_UP_RANK[b.category]! ||
    b.dosage - a.dosage ||
    b.count - a.count
  )
}

/**
 * Count each column's drawn rows by (class, dosage, colour), the three things
 * that tell its cells apart on screen, so a segment is the cells it stands for
 * in their own colour under every colour mode. Only the non-reference bucket is
 * walked: a drawn row with no such cell is a reference call or an unpainted one,
 * both of which the rows show as the reference grey.
 */
export function countFrequencyColumns(
  cells: FrequencyCells,
  numColumns: number,
  drawnRows: number,
): FrequencyColumns {
  const {
    numCells,
    refCellCount,
    cellRowIndices,
    cellFeatureIndices,
    cellColors,
    cellAltDosage,
    cellCategories,
  } = cells
  const referenceColor = getCachedABGR(REFERENCE_COLOR)
  const segmentStart = new Uint32Array(numColumns + 1)
  const count: number[] = []
  const color: number[] = []
  const category: number[] = []
  const dosage: number[] = []
  const groups: Group[] = []
  let i = refCellCount
  for (let c = 0; c < numColumns; c++) {
    segmentStart[c] = count.length
    groups.length = 0
    let painted = 0
    for (; i < numCells && cellFeatureIndices[i] === c; i++) {
      if (cellRowIndices[i] !== HIDDEN_ROW) {
        const k = cellCategories[i]!
        const d = cellAltDosage[i]!
        const rgba = cellColors[i]!
        let g = 0
        while (
          g < groups.length &&
          (groups[g]!.category !== k ||
            groups[g]!.dosage !== d ||
            groups[g]!.color !== rgba)
        ) {
          g++
        }
        if (g === groups.length) {
          groups.push({ category: k, dosage: d, color: rgba, count: 0 })
        }
        groups[g]!.count++
        painted++
      }
    }
    if (drawnRows > painted) {
      groups.push({
        category: CELL_REF,
        dosage: 0,
        color: referenceColor,
        count: drawnRows - painted,
      })
    }
    groups.sort(bottomUp)
    for (const g of groups) {
      count.push(g.count)
      color.push(g.color)
      category.push(g.category)
      dosage.push(g.dosage)
    }
  }
  segmentStart[numColumns] = count.length
  return {
    numColumns,
    drawnRows,
    segmentStart,
    segmentCount: Uint32Array.from(count),
    segmentColor: Uint32Array.from(color),
    segmentCategory: Uint8Array.from(category),
    segmentDosage: Uint8Array.from(dosage),
  }
}

function segmentLabel(category: number, dosage: number, phased: boolean) {
  const L = GENOTYPE_CLASS_LABELS
  if (category === CELL_ALT) {
    return phased ? L.alt : dosage === 255 ? L.hom : L.het
  }
  if (category === CELL_ALT_SECONDARY) {
    return L.otherAlt
  }
  if (category === CELL_REF) {
    return phased ? L.ref : L.homRef
  }
  return category === CELL_UNPHASED ? L.unphased : L.noCall
}

/**
 * A column's counts as tooltip rows, bottom to top, under the key's names:
 * segments a colour splits (a phase set's hues, a triploid's two partial
 * dosages) merge into the class they belong to.
 */
export function frequencyTooltipRows(
  columns: FrequencyColumns,
  column: number,
  phased: boolean,
) {
  const { drawnRows, segmentStart, segmentCount, segmentCategory } = columns
  const byLabel = new Map<string, number>()
  for (let s = segmentStart[column]!; s < segmentStart[column + 1]!; s++) {
    const label = segmentLabel(
      segmentCategory[s]!,
      columns.segmentDosage[s]!,
      phased,
    )
    byLabel.set(label, (byLabel.get(label) ?? 0) + segmentCount[s]!)
  }
  return [...byLabel].map(([label, n]) => ({
    label,
    value: `${n} (${((100 * n) / drawnRows).toFixed(1)}%)`,
  }))
}

/** Where a column's bars run in a band `height` tall: the coverage box. */
export function frequencyBarBox(height: number) {
  const { effectiveH, bottom } = coverageLayout(height)
  return { top: bottom - effectiveH, bottom }
}

export interface FrequencyCtx {
  fillStyle: string | CanvasGradient | CanvasPattern
  fillRect(x: number, y: number, w: number, h: number): void
}

/**
 * Paint one column at `[left, left + width)`. Edges land on whole pixels so
 * abutting segments leave no seam, and a carrier or missing class with any
 * count takes at least a pixel, so a singleton among hundreds of rows still
 * shows; the reference remainder gives up what the floors take.
 */
export function paintFrequencyColumn(
  ctx: FrequencyCtx,
  columns: FrequencyColumns,
  column: number,
  left: number,
  width: number,
  box: { top: number; bottom: number },
) {
  const { drawnRows, segmentStart, segmentCount, segmentColor } = columns
  const { segmentCategory } = columns
  const start = segmentStart[column]!
  const end = segmentStart[column + 1]!
  const scale = (box.bottom - box.top) / drawnRows
  let reference = -1
  let below = box.bottom
  let sum = 0
  for (let s = start; s < end; s++) {
    const k = segmentCategory[s]!
    if (!isCarrier(k)) {
      reference = k === CELL_REF ? s : -1
      break
    }
    sum += segmentCount[s]!
    const y = Math.min(below - 1, Math.round(box.bottom - sum * scale))
    setAbgrFill(ctx, segmentColor[s]!)
    ctx.fillRect(left, y, width, below - y)
    below = y
  }
  let above = box.top
  sum = 0
  for (let s = end - 1; s >= start && segmentCategory[s] !== CELL_REF; s--) {
    if (isCarrier(segmentCategory[s]!)) {
      break
    }
    sum += segmentCount[s]!
    const y = Math.max(above + 1, Math.round(box.top + sum * scale))
    setAbgrFill(ctx, segmentColor[s]!)
    ctx.fillRect(left, above, width, y - above)
    above = y
  }
  if (reference !== -1 && below > above) {
    setAbgrFill(ctx, segmentColor[reference]!)
    ctx.fillRect(left, above, width, below - above)
  }
}
