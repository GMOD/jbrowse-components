import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import {
  Canvas2DAlignmentsRenderer,
  drawAlignmentsToCtx,
} from './Canvas2DAlignmentsRenderer.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { RenderState } from './rendererTypes.ts'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

/**
 * Whole-draw-path orientation guard, one invariant for every layer at once:
 *
 *   **a reversed block must render the mirror image of the forward block.**
 *
 * A feature spanning bp [b, b+len] lands at screen [f(b), f(b+len)] forward and
 * at [W-f(b+len), W-f(b)] reversed, so every mark the pileup emits has a
 * mirrored twin. Data-independent — no expected coordinates to hand-compute and
 * get wrong — and it exercises the real orchestrator (`drawAlignmentBlocks`:
 * block clip, sections, layer gating) rather than one painter in isolation.
 *
 * Runs over two configs because layer gating decides what's reachable at all: a
 * plain pileup (reads, deletion gaps, the four 1bp-cell layers, soft-clip bases,
 * insertions) and a linked-reads layout, which is the only way to reach overlaps
 * and the connecting / linked-read line layers. Between them this is every
 * pileup-band layer.
 *
 * Two traps the fixture guards against, both of which made an earlier draft
 * prove less than it looked like it proved:
 * - Reads paint chevrons via `fill()` on a path and never call `fillRect`, so a
 *   rect-only recorder scores them as zero marks and mirrors them vacuously.
 *   Path vertices are captured too.
 * - A layer that silently stops drawing turns the mirror into a comparison of
 *   two empty sets. Hence the non-empty assertions per config, and the check
 *   that the linked-reads config really does draw more than the plain one.
 *
 * A one-base slip shows up as a PX_PER_BP-sized mirror violation, far outside
 * the tolerance below. Deliberately not a snapshot: a snapshot of a reversed
 * pileup would have recorded the off-by-one-base bug as the expected output.
 */

const START = 1000
const END = 1050
const BP_LENGTH = END - START
const BLOCK_WIDTH = 1000
// 20 px/bp — a one-base error is 20px.
const PX_PER_BP = BLOCK_WIDTH / BP_LENGTH

const COV_H = 100

// The seam fudge (+0.5) and the coverage bar fudge (+0.8) always overdraw to the
// RIGHT in local space, so they don't mirror. That's intentional (they close
// Canvas2D AA seams, they aren't feature geometry), and it bounds mirror error
// at <1px — 20x smaller than the one-base error this is watching for.
const FUDGE_TOLERANCE_PX = 1

// A drawn mark: either a filled rect (cells, gaps) or one vertex of a filled
// path (the read chevrons). Reads never call fillRect once the chevron gate
// opens, so a rect-only recorder would score them as "no marks" and mirror
// them vacuously.
interface Mark {
  kind: 'rect' | 'vertex'
  x: number
  y: number
  w: number
}

function recordingCtx() {
  const marks: Mark[] = []
  return {
    marks,
    ctx: {
      set fillStyle(_v: string) {},
      get fillStyle() {
        return ''
      },
      set strokeStyle(_v: string) {},
      get strokeStyle() {
        return ''
      },
      lineWidth: 1,
      fillRect(x: number, y: number, w: number) {
        marks.push({ kind: 'rect', x, y, w })
      },
      strokeRect() {},
      setTransform() {},
      translate() {},
      clearRect() {},
      beginPath() {},
      moveTo(x: number, y: number) {
        marks.push({ kind: 'vertex', x, y, w: 0 })
      },
      lineTo(x: number, y: number) {
        marks.push({ kind: 'vertex', x, y, w: 0 })
      },
      closePath() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      // `rect()` is the clip path, not content — excluded on purpose.
      rect() {},
      clip() {},
    } as unknown as CanvasRenderingContext2D,
  }
}

// Two reads on separate rows (opposite strands, so both chevron directions are
// exercised), each one ungapped segment, plus per-base marks of every 1bp-cell
// kind and a deletion gap. Positions are asymmetric within the block so a mirror
// can't pass by accident.
function pileupData(): PileupDataResult {
  const readStarts = [1005, 1030]
  const readEnds = [1020, 1044]
  return {
    regionStart: START,
    readPositions: new Uint32Array([
      readStarts[0]!,
      readEnds[0]!,
      readStarts[1]!,
      readEnds[1]!,
    ]),
    readYs: new Uint16Array([0, 1]),
    readFlags: new Uint16Array([0, 0]),
    readMapqs: new Uint8Array([60, 60]),
    readInsertSizes: new Float32Array([0, 0]),
    readPairOrientations: new Uint8Array([0, 0]),
    readStrands: new Int8Array([1, -1]),
    readInterchrom: new Uint8Array([0, 0]),
    readTagColors: new Uint32Array(0),
    readChainHasSupp: undefined,
    readIds: ['r1', 'r2'],
    insertSizeStats: undefined,
    maxY: 2,
    segmentPositions: new Uint32Array([
      readStarts[0]!,
      readEnds[0]!,
      readStarts[1]!,
      readEnds[1]!,
    ]),
    segmentReadIndices: new Uint32Array([0, 1]),
    // both first+last (0b11): a single-exon read
    segmentEdgeFlags: new Uint8Array([0b11, 0b11]),
    numSegments: 2,

    // deletion gap inside read 0 — drawGaps resolves two edges
    gapPositions: new Uint32Array([1012, 1015]),
    gapYs: new Uint16Array([0]),
    gapTypes: new Uint8Array([0]),
    gapFrequencies: new Uint8Array([255]),

    mismatchPositions: new Uint32Array([1008, 1035]),
    mismatchYs: new Uint16Array([0, 1]),
    mismatchBases: new Uint8Array([65, 67]),
    mismatchFrequencies: new Uint8Array([255, 255]),
    mismatchQuals: new Uint8Array([0, 0]),

    // One small insertion (len 3) at bp 1018 on read 0. Interbase arrays are
    // partitioned [insertions | softclips | hardclips] by numInsertions/
    // numSoftclips/numHardclips (interbaseRangeEnds); only the insertion slice
    // is populated. drawInsertions centers a boundary marker on the bp — the
    // marker must land at the mirror position on a reversed block.
    interbasePositions: new Uint32Array([1018]),
    interbaseYs: new Uint16Array([0]),
    interbaseLengths: new Uint16Array([3]),
    interbaseFrequencies: new Uint8Array([255]),
    numInsertions: 1,
    numSoftclips: 0,
    numHardclips: 0,
    // Two soft-clipped bases (a per-base 1bp-cell layer, gated on
    // showSoftClipping) just left of read 0's aligned start. These paint via
    // makeCellLeftMapper like the other cell layers, so a reversed block must
    // mirror them cell-for-cell.
    softclipBasePositions: new Uint32Array([1002, 1003]),
    softclipBaseYs: new Uint16Array([0, 0]),
    softclipBaseBases: new Uint8Array([65, 67]),

    modificationPositions: new Uint32Array([1010]),
    modificationYs: new Uint16Array([0]),
    modificationColors: new Uint32Array([0xff00ff00]),

    perBaseQualPositions: new Uint32Array([1006, 1007]),
    perBaseQualYs: new Uint16Array([0, 0]),
    perBaseQualScores: new Uint8Array([30, 40]),
    perBaseQualReadIndices: new Uint32Array([0, 0]),

    perBaseLetterPositions: new Uint32Array([1032]),
    perBaseLetterYs: new Uint16Array([1]),
    perBaseLetterBases: new Uint8Array([84]),
    perBaseLetterReadIndices: new Uint32Array([1]),

    // Mate-overlap band on read 0 — a two-edge Math.min/abs span. Only drawn
    // in the linked-reads config below (shouldDrawOverlaps).
    overlapPositions: new Uint32Array([1016, 1019]),
    overlapYs: new Uint16Array([0]),

    // Connecting line between the two reads, and a linked-read line spanning
    // rows. Both paint as paths (moveTo/lineTo), and both are linked-reads-only.
    connectingLinePositions: new Uint32Array([1020, 1030]),
    connectingLineYs: new Uint16Array([0]),
    linkedReadLinePositions: new Uint32Array([1005, 1044]),
    linkedReadLineYs: new Uint16Array([0, 1]),
    linkedReadLineColorTypes: new Uint8Array([0]),
    numLinkedReadLines: 1,

    modCovPositions: new Uint32Array(),
    modCovYOffsets: new Float32Array(),
    modCovHeights: new Float32Array(),
    modCovColors: new Uint32Array(),
    modCovRelDepths: new Float32Array(),
    modCovPackedBuffer: new ArrayBuffer(0),
    snpPackedBuffer: new ArrayBuffer(0),
    interbasePackedBuffer: new ArrayBuffer(0),
    interbaseMaxCount: 0,
    indicatorPackedBuffer: new ArrayBuffer(0),
    // Five covered bases, asymmetric depths so the band can't mirror by
    // accident. The coverage layers had their own reversed bug (bars clamped to
    // 1px slivers, anchored a bin off); an earlier version of this fixture left
    // coverage off "to avoid fudge-factor noise" and sailed straight past it.
    coverageDepths: new Float32Array([3, 9, 5, 8, 2]),
    coverageMaxDepth: 9,
    coverageStartPos: 1006,
    coverageBinSize: 1,
    coverageGpuBinCount: 0,
    coveragePackedBuffer: new ArrayBuffer(0),
    snpPositions: new Uint32Array(),
    snpYOffsets: new Float32Array(),
    snpHeights: new Float32Array(),
    snpColorTypes: new Uint8Array(),
    snpRelDepths: new Float32Array(),
    interbaseCovPositions: new Uint32Array(),
    interbaseCovYOffsets: new Float32Array(),
    interbaseCovHeights: new Float32Array(),
    interbaseCovColorTypes: new Uint8Array(),
    indicatorPositions: new Uint32Array(),
    indicatorColorTypes: new Uint8Array(),
  } as unknown as PileupDataResult
}

const triple: [number, number, number] = [0.5, 0.5, 0.5]

function state(overrides: Partial<RenderState> = {}): RenderState {
  const section = {
    pileupTopOffset: COV_H,
    coverageTopOffset: 0,
    covClipTop: 0,
    covClipHeight: COV_H,
    pileupClipTop: COV_H,
    pileupClipHeight: 200,
  }
  return {
    canvasWidth: BLOCK_WIDTH,
    canvasHeight: 200 + COV_H,
    scrollTop: 0,
    colorScheme: 0,
    featureHeight: 10,
    featureSpacing: 1,
    // Coverage ON. The band's 0.8px fudge is what FUDGE_TOLERANCE_PX absorbs;
    // leaving the band out to dodge that noise is precisely what let its own
    // reversed bug through.
    showCoverage: true,
    coverageHeight: COV_H,
    coverageYOffset: 0,
    coverageMaxDepth: 9,
    coverageIsLog: false,
    showMismatches: true,
    filterMismatchesByFrequency: false,
    mismatchAlpha: false,
    // ON so the soft-clip-base cell layer (gated on this) is reachable; the
    // insertion layer rides showMismatches, already on.
    showSoftClipping: true,
    showInterbaseIndicators: false,
    showModifications: true,
    showPerBaseQuality: true,
    showPerBaseLetter: true,
    selectedChainIds: [],
    selectedFeatureId: undefined,
    colors: {
      colorFwdStrand: triple,
      colorRevStrand: triple,
      colorNostrand: triple,
      colorPairLR: triple,
      colorPairRL: triple,
      colorPairRR: triple,
      colorPairLL: triple,
      colorBaseA: triple,
      colorBaseC: triple,
      colorBaseG: triple,
      colorBaseT: triple,
      colorBaseN: triple,
      colorInsertion: triple,
      colorDeletion: triple,
      colorSkip: triple,
      colorSoftclip: triple,
      colorHardclip: triple,
      colorInsertionIndicator: triple,
      colorSoftclipIndicator: triple,
      colorHardclipIndicator: triple,
      colorCoverage: triple,
      colorModificationFwd: triple,
      colorModificationRev: triple,
      colorMutedSnpBase: triple,
      colorLongInsert: triple,
      colorShortInsert: triple,
      colorSupplementary: triple,
      colorSplitInversion: triple,
      colorUnmappedMate: triple,
      colorInterchrom: triple,
    },
    linkedReads: 'off',
    showLinkedReadLines: false,
    flipStrandLongReadChains: false,
    colorSupplementaryChains: false,
    readConnectionsLineWidth: 1,
    readConnections: 'off',
    readConnectionsDown: false,
    readConnectionsHeight: 0,
    showOutline: false,
    pileupTopOffset: 0,
    coverageTopOffset: 0,
    sections: [section],
    ...overrides,
  } as unknown as RenderState
}

function drawAt(reversed: boolean, overrides: Partial<RenderState> = {}) {
  const { ctx, marks } = recordingCtx()
  const canvas = {
    getContext: () => ctx,
    width: 0,
    height: 0,
  } as unknown as HTMLCanvasElement
  const renderer = new Canvas2DAlignmentsRenderer(canvas)
  renderer.sync({
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, pileupData()]]),
        arcsRpcDataMap: new Map(),
      },
    ],
  })
  renderer.renderBlocks(
    [
      {
        displayedRegionIndex: 0,
        start: START,
        end: END,
        screenStartPx: 0,
        screenEndPx: BLOCK_WIDTH,
        reversed,
      },
    ],
    state(overrides),
  )
  return marks
}

// A rect mirrors about its far edge (x → W-x-w); a path vertex is a point
// (x → W-x).
function mirrorX(m: Mark) {
  return BLOCK_WIDTH - m.x - m.w
}

// Two configs, because layer gating decides what's even reachable. The plain
// pileup can't draw overlaps or either line layer (`shouldDrawOverlaps` and the
// connLine/linkedReadLine gates all need a linked-reads layout), so without the
// second config those three layers have no reversed coverage anywhere.
const CONFIGS: { name: string; overrides: Partial<RenderState> }[] = [
  { name: 'plain pileup', overrides: {} },
  {
    name: 'linked reads (adds overlaps + connecting/linked-read lines)',
    overrides: {
      linkedReads: 'normal',
      showLinkedReadLines: true,
    },
  },
]

describe.each(CONFIGS)(
  'reversed block renders the mirror of the forward block — $name',
  ({ overrides }) => {
    const forward = drawAt(false, overrides)
    const reversed = drawAt(true, overrides)

    it('lights up both kinds of mark, so neither mirrors vacuously', () => {
      // Guards the fixture itself: if a gate silently stops a layer drawing,
      // the mirror check below would pass on an empty set and prove nothing.
      expect(forward.filter(m => m.kind === 'rect').length).toBeGreaterThan(0)
      expect(forward.filter(m => m.kind === 'vertex').length).toBeGreaterThan(0)
      expect(reversed.length).toBe(forward.length)
    })

    it('every forward mark has a mirrored counterpart on the same row', () => {
      // Match on the same y so a coincidental x-match on a different row can't
      // stand in for the real twin.
      const unmatched = forward.filter(f => {
        const wantX = mirrorX(f)
        return !reversed.some(
          r =>
            r.kind === f.kind &&
            r.y === f.y &&
            Math.abs(r.w - f.w) <= FUDGE_TOLERANCE_PX &&
            Math.abs(r.x - wantX) <= FUDGE_TOLERANCE_PX,
        )
      })
      expect(unmatched).toEqual([])
    })
  },
)

// The linked-reads config must actually reach the layers it exists for,
// otherwise it silently degrades into a duplicate of the plain one.
it('the linked-reads config draws strictly more than the plain pileup', () => {
  expect(drawAt(false, CONFIGS[1]!.overrides).length).toBeGreaterThan(
    drawAt(false, CONFIGS[0]!.overrides).length,
  )
})

// Guard the two layers this fixture was extended to reach (soft-clip bases +
// insertions). The mirror check above compares reversed against forward, so if
// a gate silently dropped a layer in *both* it would still pass — assert each
// puts its expected mark on the forward render. Positions are exact from the
// fixture: bp→x is (bp - 1000) / 50 * 1000 = 20 px/bp.
it('the soft-clip-base and insertion layers are non-vacuous', () => {
  const marks = drawAt(false)
  // Turning soft-clipping off must remove marks — proves the layer is gated
  // and currently drawing, not dead.
  expect(marks.length).toBeGreaterThan(
    drawAt(false, { showSoftClipping: false }).length,
  )
  // Soft-clip base at bp 1002 → cell left edge at x = 40 (unique: coverage
  // starts at bp 1006 = x 120, nothing else paints this far left).
  expect(marks.some(m => m.kind === 'rect' && Math.abs(m.x - 40) < 1)).toBe(
    true,
  )
  // Small-insertion box at bp 1018 → centered at x = 360, 1px wide, so the
  // rect sits at x ≈ 359.5 with w ≈ 1 (the only ~1px-wide rect here).
  expect(
    marks.some(
      m =>
        m.kind === 'rect' &&
        Math.abs(m.x - 359.5) < 1 &&
        Math.abs(m.w - 1) < 0.6,
    ),
  ).toBe(true)
})

it('the tolerance is far tighter than the bug it guards against', () => {
  // A one-base slip moves a mark PX_PER_BP; the tolerance only absorbs the
  // sub-pixel seam fudge. If this ever inverts, the mirror checks go blind.
  expect(FUDGE_TOLERANCE_PX).toBeLessThan(PX_PER_BP / 4)
})

// The selection box is the one span in the shared draw path emitted as
// `strokeRect(x1, y, x2 - x1, h)`. On a reversed block bpToScreenX flips, so
// x2 < x1 and the width goes negative. The raster canvas normalizes a negative
// rect, but SvgCanvas emitted `width="-…"`, which SVG refuses to render — so a
// selected read's box vanished only in SVG export of a reversed view. The
// recording ctx above no-ops strokeRect, so this exercises the real SvgCanvas
// export path (the same drawAlignmentsToCtx renderSvg.tsx calls).
describe('reversed selection box SVG export', () => {
  function exportSvg(reversed: boolean) {
    const svg = new SvgCanvas()
    drawAlignmentsToCtx(
      svg,
      {
        sections: [
          {
            groupKey: '',
            laidOutPileupMap: new Map([[0, pileupData()]]),
            arcsRpcDataMap: new Map(),
          },
        ],
      },
      [
        {
          displayedRegionIndex: 0,
          start: START,
          end: END,
          screenStartPx: 0,
          screenEndPx: BLOCK_WIDTH,
          reversed,
        },
      ],
      // read r1 spans [1005,1020]: forward → [100,400], reversed → [600,900].
      state({ selectedFeatureId: 'r1' }),
    )
    return svg.getSerializedSvg()
  }

  // The selection box is the only #00b8ff stroke; pull just that <rect>.
  const selectionRect = (svg: string) =>
    /<rect [^>]*stroke="#00b8ff"[^>]*\/>/.exec(svg)?.[0]

  it('emits a valid positive-width rect (never width="-…")', () => {
    const rev = exportSvg(true)
    expect(rev).not.toContain('width="-')
    const rect = selectionRect(rev)
    expect(rect).toBeDefined()
    // reversed: min(600,900)=600, width abs(900-600)=300.
    expect(rect).toContain('x="600"')
    expect(rect).toContain('width="300"')
  })

  it('mirrors the forward box: same width, edge W - x - w', () => {
    const fwd = selectionRect(exportSvg(false))!
    // forward: x=100, width=300 → mirror edge = 1000 - 100 - 300 = 600.
    expect(fwd).toContain('x="100"')
    expect(fwd).toContain('width="300"')
  })
})
