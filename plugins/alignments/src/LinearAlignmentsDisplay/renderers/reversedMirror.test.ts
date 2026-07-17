import { Canvas2DAlignmentsRenderer } from './Canvas2DAlignmentsRenderer.ts'

import type { RenderState } from './rendererTypes.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

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
 * Covers the layers this fixture actually lights up: reads (chevron paths),
 * deletion gaps (a two-edge `Math.min` span, only ever argued orientation-safe,
 * never tested), and the four 1bp-cell layers. Reads paint as paths, not rects,
 * so vertices are captured too — without that they'd silently contribute
 * nothing. Overlaps are NOT covered: `shouldDrawOverlaps` needs a linked-reads
 * layout, which this fixture isn't.
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

    interbasePositions: new Uint32Array(),
    interbaseYs: new Uint16Array(),
    interbaseLengths: new Uint16Array(),
    interbaseFrequencies: new Uint8Array(),
    numInsertions: 0,
    numSoftclips: 0,
    numHardclips: 0,
    softclipBasePositions: new Uint32Array(),
    softclipBaseYs: new Uint16Array(),
    softclipBaseBases: new Uint8Array(),

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

    // Empty: the overlap pass only runs in a linked-reads layout
    // (shouldDrawOverlaps), which this fixture deliberately isn't.
    overlapPositions: new Uint32Array(),
    overlapYs: new Uint16Array(),

    connectingLinePositions: new Uint32Array(),
    connectingLineYs: new Uint16Array(),
    linkedReadLinePositions: new Uint32Array(),
    linkedReadLineYs: new Uint16Array(),
    linkedReadLineColorTypes: new Uint8Array(),
    numLinkedReadLines: 0,

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
    coverageDepths: new Float32Array(),
    coverageMaxDepth: 0,
    coverageStartPos: START,
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

function state(): RenderState {
  const section = {
    pileupTopOffset: 0,
    coverageTopOffset: 0,
    covClipTop: 0,
    covClipHeight: 0,
    pileupClipTop: 0,
    pileupClipHeight: 200,
  }
  return {
    canvasWidth: BLOCK_WIDTH,
    canvasHeight: 200,
    scrollTop: 0,
    colorScheme: 0,
    featureHeight: 10,
    featureSpacing: 1,
    // Coverage off: this is a pileup-geometry test, and the coverage band's
    // own fudge factor would only add noise.
    showCoverage: false,
    coverageHeight: 0,
    coverageYOffset: 0,
    coverageMaxDepth: undefined,
    coverageIsLog: false,
    showMismatches: true,
    filterMismatchesByFrequency: false,
    mismatchAlpha: false,
    showSoftClipping: false,
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
  } as unknown as RenderState
}

function drawAt(reversed: boolean) {
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
    state(),
  )
  return marks
}

// A rect mirrors about its far edge (x → W-x-w); a path vertex is a point
// (x → W-x).
function mirrorX(m: Mark) {
  return BLOCK_WIDTH - m.x - m.w
}

describe('reversed block renders the mirror of the forward block', () => {
  const forward = drawAt(false)
  const reversed = drawAt(true)

  it('lights up both kinds of mark, so neither mirrors vacuously', () => {
    // Guards the fixture itself: if a gate silently stops a layer drawing, the
    // mirror check below would pass on an empty set and prove nothing.
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

  it('the tolerance is far tighter than the bug it guards against', () => {
    // A one-base slip moves a mark PX_PER_BP; the tolerance only absorbs the
    // sub-pixel seam fudge. If this ever inverts, the test above goes blind.
    expect(FUDGE_TOLERANCE_PX).toBeLessThan(PX_PER_BP / 4)
  })
})
