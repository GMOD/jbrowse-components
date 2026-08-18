import {
  chevronCount,
  chevronFirstVisible,
  chevronLastVisible,
  chevronOffset,
} from '../passes/shaders/chevron.js.generated.ts'
import {
  CHEVRON_SPACING_PX,
  CHEVRON_W_PX,
  MAX_VISIBLE_CHEVRONS_PER_LINE,
} from './sharedRendererConstants.ts'

// The retirement gate for chevron.slang's window (adr-051), and the one export
// in the set that replaced code on BOTH sides rather than a Canvas2D twin of a
// shader function: the window was written inline in `vs_main` and again inline
// in `drawLines`, in bp and in px respectively, and the two did not agree.
//
// So the fixtures below are both retired spellings, and the first test is the
// only one here that is a bug report rather than a parity check: the Canvas2D
// window is asserted to have been WRONG, so that "the generated function matches
// what was there" cannot be read as "nothing changed".

const HALF_W = CHEVRON_W_PX / 2

// `drawLines`, before the lift: the window over each chevron's CENTRE.
function retiredCanvasRange(
  minX: number,
  spacing: number,
  total: number,
  canvasWidth: number,
): [number, number] {
  return [
    Math.max(0, Math.ceil(-minX / spacing - 1)),
    Math.min(total - 1, Math.floor((canvasWidth - minX) / spacing - 1)),
  ]
}

// `vs_main`, before the lift: floor/ceil with a whole slot of padding at each
// end. Generous rather than exact — the GPU culls what it over-draws — which is
// why it happened to cover the arms and the Canvas2D copy did not.
function retiredShaderRange(
  viewportStart: number,
  viewportEnd: number,
  spacing: number,
  total: number,
): [number, number] {
  return [
    Math.max(0, Math.floor(viewportStart / spacing) - 1),
    Math.min(total - 1, Math.ceil(viewportEnd / spacing)),
  ]
}

const CANVAS_WIDTH = 800
// A line placed so it runs off the left, sits wholly inside, straddles the right
// edge, and finally misses the canvas in either direction.
const OFFSETS = [-1e6, -5000, -400, -2, 0, 1, 300, 795, 800, 1200, 1e6]
const LINE_WIDTHS = [20, 39.9, 40, 100, 1000, 1e5, 1e6]
// The exhaustive per-chevron scan below walks every slot a line has, and a 1e6px
// intron has 25000 of them. The long lines are what the window exists for, so
// they stay in the cheap bounds tests; the scan takes the widths where checking
// every chevron is affordable.
const SCANNABLE_LINE_WIDTHS = [20, 39.9, 40, 100, 1000, 5000]

function windowFor(minX: number, lineWidthPx: number) {
  const total = chevronCount(lineWidthPx)
  const spacing = chevronOffset(lineWidthPx, total, 0)
  return {
    total,
    spacing,
    first: chevronFirstVisible(-minX, spacing, HALF_W),
    last: chevronLastVisible(CANVAS_WIDTH - minX, spacing, total, HALF_W),
  }
}

// What `drawLines` actually paints: chevron `c` centred here, arms ±HALF_W.
function centerOf(minX: number, lineWidthPx: number, total: number, c: number) {
  return minX + chevronOffset(lineWidthPx, total, c)
}

test('the Canvas2D window it replaced dropped a chevron straddling an edge', () => {
  const lineWidthPx = 1000
  const total = chevronCount(lineWidthPx)
  const spacing = chevronOffset(lineWidthPx, total, 0)
  // Chevron 0 centred one px left of the canvas: its arms still reach x >= 0, so
  // the GPU drew it and Canvas2D did not.
  const minX = -spacing - 1
  expect(retiredCanvasRange(minX, spacing, total, CANVAS_WIDTH)[0]).toBe(1)
  expect(chevronFirstVisible(-minX, spacing, HALF_W)).toBe(0)
  expect(
    retiredShaderRange(-minX, CANVAS_WIDTH - minX, spacing, total)[0],
  ).toBe(0)
})

test('the window admits every chevron that puts ink on the canvas', () => {
  for (const lineWidthPx of SCANNABLE_LINE_WIDTHS) {
    for (const minX of OFFSETS) {
      const { total, first, last } = windowFor(minX, lineWidthPx)
      for (let c = 0; c < total; c++) {
        const cx = centerOf(minX, lineWidthPx, total, c)
        if (cx + HALF_W >= 0 && cx - HALF_W <= CANVAS_WIDTH) {
          expect(c).toBeGreaterThanOrEqual(first)
          expect(c).toBeLessThanOrEqual(last)
        }
      }
    }
  }
})

test('and admits nothing whose glyph misses the canvas by a whole slot', () => {
  // The complement, stated loosely on purpose: iterating a chevron just past the
  // edge is free (the stroke is clipped), so the window is allowed slack. What it
  // must not do is walk the millions of slots a long intron has off screen, which
  // is the cost this window exists to avoid.
  for (const lineWidthPx of LINE_WIDTHS) {
    for (const minX of OFFSETS) {
      const { total, spacing, first, last } = windowFor(minX, lineWidthPx)
      for (const c of [first, last]) {
        if (c >= 0 && c <= total - 1 && first <= last) {
          const cx = centerOf(minX, lineWidthPx, total, c)
          expect(cx).toBeGreaterThan(-spacing - HALF_W)
          expect(cx).toBeLessThan(CANVAS_WIDTH + spacing + HALF_W)
        }
      }
    }
  }
})

test('the window never runs past the chevrons that exist', () => {
  for (const lineWidthPx of LINE_WIDTHS) {
    for (const minX of OFFSETS) {
      const { total, first, last } = windowFor(minX, lineWidthPx)
      expect(first).toBeGreaterThanOrEqual(0)
      expect(last).toBeLessThanOrEqual(total - 1)
    }
  }
})

test('a line entirely off the canvas yields an empty window', () => {
  const lineWidthPx = 1000
  for (const minX of [-1e6, 1e6]) {
    const { first, last } = windowFor(minX, lineWidthPx)
    expect(first).toBeGreaterThan(last)
  }
})

test('it is at least as tight as the shader window it replaced', () => {
  // The vertex budget in sharedRendererConstants is sized off how many slots the
  // window walks, so tightening it can only widen the block MAX_VISIBLE_CHEVRONS
  // _PER_LINE covers. Asserted rather than argued, since that paragraph quotes a
  // number derived from it.
  for (const lineWidthPx of LINE_WIDTHS) {
    for (const minX of OFFSETS) {
      const { total, spacing, first, last } = windowFor(minX, lineWidthPx)
      const [retiredFirst, retiredLast] = retiredShaderRange(
        -minX,
        CANVAS_WIDTH - minX,
        spacing,
        total,
      )
      expect(last - first).toBeLessThanOrEqual(retiredLast - retiredFirst)
    }
  }
})

// The worst-case slot count over every line length and every viewport position
// along it — the sweep `MAX_VISIBLE_CHEVRONS_PER_LINE`'s paragraph quotes, run
// here so the number in that paragraph is checked rather than remembered. The
// GPU addresses `firstVisible + localChevronIndex` for a FIXED
// MAX_VISIBLE_CHEVRONS_PER_LINE slots, so a block needing more silently loses
// its far-end chevrons — and only on the GPU, since Canvas2D has no cap.
//
// No bpPerPx axis, and that is the window being unit-agnostic: the slot count
// turns on `reach / spacing`, in which the bp↔px conversion cancels.
function worstCaseSlots(blockPx: number) {
  let max = 0
  for (let mult = 0.001; mult <= 4096; mult *= 1.3) {
    const lineWidthPx = Math.max(CHEVRON_SPACING_PX / 2, blockPx * mult)
    const total = chevronCount(lineWidthPx)
    const spacing = chevronOffset(lineWidthPx, total, 0)
    const steps = 200
    for (let k = -1; k <= steps + 1; k++) {
      // the viewport slid from the line's start to its end, plus a step off each
      const viewportStart = (k / steps) * (lineWidthPx - blockPx)
      const first = chevronFirstVisible(viewportStart, spacing, HALF_W)
      const last = chevronLastVisible(
        viewportStart + blockPx,
        spacing,
        total,
        HALF_W,
      )
      max = Math.max(max, last < first ? 0 : last - first + 1)
    }
  }
  return max
}

test('the vertex budget covers the block width its comment claims', () => {
  // 128 slots, the block width they cover, and the one just past it.
  expect(worstCaseSlots(5077)).toBeLessThanOrEqual(
    MAX_VISIBLE_CHEVRONS_PER_LINE,
  )
  expect(worstCaseSlots(5300)).toBeGreaterThan(MAX_VISIBLE_CHEVRONS_PER_LINE)
  // Sample points the paragraph quotes.
  expect(worstCaseSlots(1200)).toBe(31)
  expect(worstCaseSlots(3840)).toBe(97)
  expect(worstCaseSlots(7680)).toBe(193)
})

test('the window walks one slot more than the block spans, and no more', () => {
  // The structural claim the widths above are a consequence of. `reach` adds
  // under a tenth of a slot at any spacing the gate admits, so the ceil/floor
  // pair is the whole of the slack.
  for (const blockPx of [400, 1200, 3840, 5077, 7680]) {
    expect(worstCaseSlots(blockPx)).toBeLessThanOrEqual(
      Math.ceil(blockPx / CHEVRON_SPACING_PX) + 1,
    )
  }
})
