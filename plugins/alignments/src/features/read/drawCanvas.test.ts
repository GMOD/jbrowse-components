import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { buildReadColorCategories } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { colorSchemeIndexFor } from '../../LinearAlignmentsDisplay/constants.ts'
import { shouldOutlineReads } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { drawReads, showChevron } from './drawCanvas.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ColorSchemeType } from '../../shared/types.ts'
import type { ChevronFrame } from './drawCanvas.ts'

// The three roles these cases actually assert on; every other slot is
// makeTestPalette's zero. Spelled out in full here until the helper existed,
// which meant every new ColorPalette field was a compile error in a test that
// does not care about it.
const palette = makeTestPalette({
  colorFwdStrand: [1, 0, 0],
  colorRevStrand: [0, 0, 1],
  colorPairLR: [0, 0.5, 0],
})

interface ReadSpec {
  start: number
  end: number
  strand: number
  flags?: number
  interchrom?: number
  insertSize?: number
}

function makeRegion(reads: ReadSpec[], ys?: number[]) {
  const n = reads.length
  const readPositions = new Uint32Array(n * 2)
  const readStrands = new Int8Array(n)
  const readFlags = new Uint16Array(n)
  const readInterchrom = new Uint8Array(n)
  const readInsertSizes = new Float32Array(n)
  // One unspliced segment per read: spans the whole read, flagged first+last.
  const segmentPositions = new Uint32Array(n * 2)
  const segmentReadIndices = new Uint32Array(n)
  const segmentEdgeFlags = new Uint8Array(n)
  for (const [i, r] of reads.entries()) {
    readPositions[i * 2] = r.start
    readPositions[i * 2 + 1] = r.end
    readStrands[i] = r.strand
    readFlags[i] = r.flags ?? 0
    readInterchrom[i] = r.interchrom ?? 0
    readInsertSizes[i] = r.insertSize ?? 0
    segmentPositions[i * 2] = r.start
    segmentPositions[i * 2 + 1] = r.end
    segmentReadIndices[i] = i
    segmentEdgeFlags[i] = 0b11
  }
  return {
    readPositions,
    readYs: ys ? Uint16Array.from(ys) : new Uint16Array(n),
    readStrands,
    readFlags,
    readPairOrientations: new Uint8Array(n),
    readTagColors: new Uint32Array(n),
    readMapqs: new Uint8Array(n),
    readInsertSizes,
    readChainHasSupp: undefined,
    readInterchrom,
    segmentPositions,
    segmentReadIndices,
    segmentEdgeFlags,
  }
}

// bpLength = 100; fullBlockWidth controls pxPerBp (default 1000 → 10 px/bp).
// featureHeight 10 at row 0 with no offsets keeps the row at y=0, yMid=5.
function draw(
  reads: ReadSpec[],
  {
    colorByType = 'strand',
    ...state
  }: Partial<RenderState> & {
    colorByType?: ColorSchemeType
  } = {},
  fullBlockWidth = 1000,
) {
  const ctx = new SvgCanvas()
  const block: DrawBlock = { start: 0, end: 100, screenStartPx: 0 }
  const colorScheme = colorSchemeIndexFor(colorByType)
  // Categories come from the real classifier, so these assertions exercise
  // classify->paint end to end rather than a hand-written category byte.
  const base = makeRegion(reads)
  const region = {
    ...base,
    readColorCategories: buildReadColorCategories(base, colorByType),
  }
  drawReads(ctx, region, block, 100, fullBlockWidth, {
    featureHeight: 10,
    featureSpacing: 0,
    pileupTopOffset: 0,
    scrollTop: 0,
    chainMode: false,
    colorScheme,
    colors: palette,
    showOutline: false,
    ...state,
  } as unknown as RenderState)
  return ctx.getSerializedSvg()
}

// Read bp [10,50] at 10 px/bp → body screen span [100,500].
const wideFwd = { start: 10, end: 50, strand: 1 }
const wideRev = { start: 10, end: 50, strand: -1 }

// drawReads only re-assigns fillStyle when the resolved color changes, since
// the assignment re-parses the CSS string and the default scheme paints every
// read the same color. These pin that the skip can never leave a read wearing
// its predecessor's color. Zoomed out (0.05 px/bp) so bodies are plain rects.
test('reads of differing colors each keep their own fill', () => {
  const svg = draw([wideFwd, wideRev], {}, 5)
  expect(svg).toContain('fill="rgb(255,0,0)"')
  expect(svg).toContain('fill="rgb(0,0,255)"')
})

test('a color repeating after another still paints its own fill', () => {
  // fwd, rev, fwd: the third read must go back to red, not inherit blue.
  const svg = draw([wideFwd, wideRev, wideFwd], {}, 5)
  const fills = [...svg.matchAll(/fill="(rgb\([^"]*\))"/g)].map(m => m[1])
  expect(fills).toEqual(['rgb(255,0,0)', 'rgb(0,0,255)', 'rgb(255,0,0)'])
})

test('consecutive same-color reads each still paint their fill', () => {
  const svg = draw([wideFwd, wideFwd], {}, 5)
  const fills = [...svg.matchAll(/fill="(rgb\([^"]*\))"/g)].map(m => m[1])
  expect(fills).toEqual(['rgb(255,0,0)', 'rgb(255,0,0)'])
})

test('forward read draws an arrowhead path with apex past the right edge', () => {
  const svg = draw([wideFwd])
  expect(svg).toContain('<path')
  expect(svg).not.toContain('<rect')
  // apex at xEnd (500) + 8 = 508, at row mid-height 5
  expect(svg).toContain('L508,5')
})

test('reverse read draws an arrowhead path with apex past the left edge', () => {
  const svg = draw([wideRev])
  expect(svg).toContain('<path')
  // apex at xStart (100) - 8 = 92
  expect(svg).toContain('L92,5')
})

test('zoomed out below the base gate falls back to a plain rect', () => {
  // fullBlockWidth 5 over 100bp → 0.05 px/bp (< 0.1)
  const svg = draw([wideFwd], {}, 5)
  expect(svg).toContain('<rect')
  expect(svg).not.toContain('<path')
})

test('strandless read (strand 0) never gets an arrowhead', () => {
  const svg = draw([{ start: 10, end: 50, strand: 0 }])
  expect(svg).toContain('<rect')
  expect(svg).not.toContain('<path')
})

test('direction-moot narrow read (normal scheme) stays a rect', () => {
  // read [10,12] → 20px body, under the 30px dirless gate
  const svg = draw([{ start: 10, end: 12, strand: 1 }], {
    colorByType: 'normal',
  })
  expect(svg).toContain('<rect')
  expect(svg).not.toContain('<path')
})

test('direction-moot wide read (normal scheme) still gets an arrowhead', () => {
  const svg = draw([wideFwd], { colorByType: 'normal' })
  expect(svg).toContain('<path')
})

test('paired read whose mates collapse on screen drops the arrowhead', () => {
  // |insertSize| * pxPerBp = 0.5 * 10 = 5 < 10px span gate
  const svg = draw([{ ...wideFwd, flags: 1, insertSize: 0.5 }])
  expect(svg).toContain('<rect')
  expect(svg).not.toContain('<path')
})

test('paired read with a wide-enough span keeps the arrowhead', () => {
  // 2 * 10 = 20 >= 10px gate
  const svg = draw([{ ...wideFwd, flags: 1, insertSize: 2 }])
  expect(svg).toContain('<path')
})

// Deep-coverage scroll cost guard: drawReads must draw only the rows that reach
// the canvas band [0, canvasHeight], not every fetched row — otherwise a deep
// pileup redraws thousands of rects per scroll frame. If a future refactor drops
// the pileupRowOffCanvas guard, the first two expectations blow past their bound.
describe('drawReads visible-row-band cull', () => {
  const rows = 1000
  // strand 0 => plain rect (no chevron path), one <rect> per drawn row.
  const reads = Array.from({ length: rows }, () => ({
    start: 10,
    end: 50,
    strand: 0,
  }))
  const base = makeRegion(
    reads,
    Array.from({ length: rows }, (_, i) => i),
  )
  const region = {
    ...base,
    readColorCategories: buildReadColorCategories(base, 'strand'),
  }
  const block: DrawBlock = { start: 0, end: 100, screenStartPx: 0 }
  // rowHeight 10 => 1000 rows span 10000px of content.
  const count = (over: Partial<RenderState>) => {
    const ctx = new SvgCanvas()
    drawReads(ctx, region, block, 100, 1000, {
      featureHeight: 10,
      featureSpacing: 0,
      pileupTopOffset: 0,
      scrollTop: 0,
      chainMode: false,
      colorScheme: colorSchemeIndexFor('strand'),
      colors: palette,
      showOutline: false,
      canvasHeight: 100,
      ...over,
    } as unknown as RenderState)
    return (ctx.getSerializedSvg().match(/<rect/g) ?? []).length
  }

  test('at the top, only the ~10 rows in the 100px canvas draw', () => {
    expect(count({})).toBeLessThan(20)
  })
  test('scrolled to the middle, still only the visible band draws', () => {
    expect(count({ scrollTop: 5000 })).toBeLessThan(20)
  })
  test('a canvas tall enough for every row draws them all (cull is a no-op)', () => {
    expect(count({ canvasHeight: 100000 })).toBe(rows)
  })
})

// Retirement gate for the hand-written mirror of read.slang's chevron gate
// (adr-051). `showChevron` in drawCanvas.ts spelled the whole predicate out;
// it now unpacks the frame and calls the shader's own, generated into TS. This
// independent reimplementation stays as the fixture the generated one is swept
// against — every combination of the five inputs that changes the answer.
function shaderShowChev(
  f: ChevronFrame,
  flags: number,
  interchrom: number,
  insertSize: number,
  widthPx: number,
) {
  const baseShow = (f.chainMode || f.pxPerBp > 0.1) && f.featureHeight >= 3
  const dirMoot = f.colorScheme === 0 || (flags & 8) !== 0 || interchrom !== 0
  const isPaired = (flags & 1) !== 0
  const pairTooTight = isPaired && Math.abs(insertSize) * f.pxPerBp < 10
  return baseShow && !pairTooTight && (!dirMoot || widthPx > 30)
}

test('showChevron matches the shader predicate across a grid', () => {
  const frames: ChevronFrame[] = []
  for (const pxPerBp of [0.05, 0.2, 5]) {
    for (const chainMode of [false, true]) {
      for (const colorScheme of [0, 1, 3]) {
        for (const featureHeight of [2, 3, 10]) {
          frames.push({ pxPerBp, chainMode, colorScheme, featureHeight })
        }
      }
    }
  }
  for (const f of frames) {
    for (const flags of [0, 1, 8, 9]) {
      for (const interchrom of [0, 1]) {
        for (const insertSize of [0.5, 2, 500]) {
          for (const widthPx of [5, 30, 100]) {
            expect(showChevron(f, flags, interchrom, insertSize, widthPx)).toBe(
              shaderShowChev(f, flags, interchrom, insertSize, widthPx),
            )
          }
        }
      }
    }
  }
})

// The height gate had three spellings and the two that mattered disagreed: the
// GPU decided it host-side as `featureHeight >= 4`, this painter as `fH > 2`.
// Sharing the constant had not been enough — what drifted was the number and
// the comparison, not the name — so these pin the observable behaviour of the
// one predicate both now call, at the boundary and inside the band that used to
// separate them.
describe('the read outline height gate', () => {
  // `stroke-width=`, not `stroke=`: SvgCanvas writes a literal `stroke="none"`
  // on every FILLED path, so `stroke=` matches whether or not an outline was
  // drawn. Only `strokeAttrs()` emits the width, and only a stroke op calls it.
  //
  // Default block width (10 px/bp), so the read is 400 px wide and the per-read
  // width half of the gate is never the thing under test — the 0.05 px/bp the
  // colour tests use puts this read at exactly 2 px, which the width gate
  // rejects on its own.
  const outlined = (featureHeight: number) =>
    draw([wideFwd], { showOutline: true, featureHeight }).includes(
      'stroke-width=',
    )

  test.each([
    ['Normal', 7, true],
    ['at the boundary itself', 4, true],
    // Every one of these outlined on Canvas2D and not on the GPU. 3 is the
    // Compact preset, which `featureSpacingForHeight` also gives no inter-read
    // gap, so an outline top and bottom left one pixel of fill between two dark
    // rows. The fractional ones are reachable only in fit mode, which divides
    // pixels by rows.
    ['Compact', 3, false],
    ['a fitted height just under the boundary', 3.9, false],
    ['a fitted height just over 3', 3.01, false],
    ['Super-compact', 1, false],
  ])('%s (%p px) outlines: %p', (_label, featureHeight, expected) => {
    expect(outlined(featureHeight)).toBe(expected)
  })

  test('showOutline still switches it off at a height that would pass', () => {
    expect(
      draw([wideFwd], { showOutline: false, featureHeight: 7 }),
    ).not.toContain('stroke-width=')
  })

  // What the GPU writes into `showStroke` and what this painter branches on are
  // now the same call, so the parity is structural. This pins that it stays that
  // way if either side grows a second condition.
  test('the shared predicate is what both backends ask', () => {
    for (const featureHeight of [1, 3, 3.9, 4, 7, 20]) {
      const state = { showOutline: true, featureHeight } as RenderState
      expect(outlined(featureHeight)).toBe(shouldOutlineReads(state))
    }
  })
})
