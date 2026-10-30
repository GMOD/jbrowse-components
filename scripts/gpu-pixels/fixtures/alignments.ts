import {
  covBarHeightPx,
  covBottomOffsetPx,
  covEffectiveHeightPx,
  covSegBottomPx,
  covSegTopPx,
  normalizeDepthScalar,
} from '../../../packages/alignments-core/src/coverageBandLayout.generated.ts'
import {
  expandToMinWidthLeftPx,
  expandToMinWidthRightPx,
} from '../../../packages/alignments-core/src/spanMinWidth.generated.ts'
import * as coverageBar from '../../../packages/render-core/src/shaders/coverageBar.generated.ts'
import { extendToMinWidthPx } from '../../../packages/render-core/src/shaders/hpmath.js.generated.ts'
import * as mismatch from '../../../plugins/alignments/src/shaders/slang/mismatch.generated.ts'
import * as read from '../../../plugins/alignments/src/shaders/slang/read.generated.ts'
import { CHEVRON_PX } from '../../../plugins/alignments/src/shaders/slang/readChevron.generated.ts'
import { chevronContains } from '../../../plugins/alignments/src/shaders/slang/readChevron.js.generated.ts'
import { CLEAR, abgr, box, defineFixture, paintOver, rgba } from '../fixture.ts'

import type { Shape } from '../fixture.ts'

const SHADERS = 'plugins/alignments/src/shaders/slang'
const START = 20003

type Rgb = readonly [number, number, number]
type Vec4 = [number, number, number, number]

const BASE: Record<string, Rgb> = {
  A: [0, 200, 0],
  C: [0, 0, 255],
  G: [255, 165, 0],
  T: [255, 0, 0],
}
const FWD: Rgb = [236, 139, 139]
const REV: Rgb = [143, 143, 216]
const COVERAGE: Rgb = [190, 190, 190]

const vec4 = ([r, g, b]: Rgb): Vec4 => [r / 255, g / 255, b / 255, 1]
const slots = <T>(n: number, at: (i: number) => T) =>
  Array.from({ length: n }, (_, i) => at(i))

function pileupUniforms(
  width: number,
  height: number,
  bpPerPx: number,
  featHeight: number,
  featSpacing: number,
) {
  const zero4: Vec4 = [0, 0, 0, 0]
  return {
    bpHi: START,
    bpLo: 0,
    bpLen: width * bpPerPx,
    hpZero: 0,
    canvasW: width,
    canvasH: height,
    rangeY0: 0,
    covOffset: 0,
    featHeight,
    featSpacing,
    chainMode: 0,
    showStroke: 1,
    fadeLowFrequency: 0,
    qualityOpacityZero: 0,
    qualityOpacitySlope: 0,
    qualityOpacityMin: 1,
    qualityOpacityMax: 1,
    reversed: 0,
    colorBaseA: abgr(BASE.A!),
    colorBaseC: abgr(BASE.C!),
    colorBaseG: abgr(BASE.G!),
    colorBaseT: abgr(BASE.T!),
    colorBaseN: abgr([128, 128, 128]),
    colorInsertion: 0,
    colorDeletion: 0,
    colorSkip: 0,
    colorSoftclip: 0,
    colorHardclip: 0,
    colorConnectingLine: 0,
    colorOverlapTint: 0,
    colorOverlap: 0,
    connectorColorShift: 0,
    linkedReadColor: slots(11, () => zero4) as read.Uniforms['linkedReadColor'],
    readCategoryColor: slots(21, i =>
      i === read.RC_FWD_STRAND
        ? vec4(FWD)
        : i === read.RC_REV_STRAND
          ? vec4(REV)
          : zero4,
    ) as read.Uniforms['readCategoryColor'],
    pxPerBp: 1 / bpPerPx,
    devicePixelRatio: 1,
  }
}

// --- coverage bars ---

const COV_W = 200
const COV_H = 60
const COV_BP_PER_PX = 3.7
const COV_INSET = 5
const BIN_BP = 10
const covPx = (b: number) => (b - START) / COV_BP_PER_PX
const bins = Array.from({ length: 73 }, (_, i) => ({
  position: START + 1 + i * BIN_BP,
  depth: 20 + ((i * 37) % 71) + 0.37 * i,
}))

function coverageBarShape(position: number, depth: number): Shape {
  const x1 = covPx(position)
  const x2 = covPx(position + BIN_BP)
  const left = expandToMinWidthLeftPx(x1, x2, 1)
  const right = expandToMinWidthRightPx(x1, x2, 1)
  const baseline = covBottomOffsetPx(COV_H, COV_INSET)
  const barPx = covBarHeightPx(
    normalizeDepthScalar(depth, 0, 100, 0, 1),
    covEffectiveHeightPx(COV_H, COV_INSET),
  )
  const bottom = covSegBottomPx(baseline, 0, barPx)
  const top = covSegTopPx(baseline, 0, 1, barPx)
  return {
    inside: box(left, top, right, bottom),
    color: rgba(COVERAGE),
    bounds: [left, top, right, bottom],
  }
}

const coverageBarFixture = defineFixture({
  name: 'alignments-coverage-bar',
  slang: 'packages/render-core/src/shaders/coverageBar.slang',
  about: `abutting ${BIN_BP} bp coverage bins, ${(BIN_BP / COV_BP_PER_PX).toFixed(2)} px wide at fractional edges, varied depths`,
  mod: coverageBar,
  width: COV_W,
  height: COV_H,
  count: bins.length,
  instances: {
    position: bins.map(b => b.position),
    relDepth: bins.map(b => b.depth / 100),
  },
  uniforms: () => ({
    bpHi: START,
    bpLo: 0,
    bpLen: COV_W * COV_BP_PER_PX,
    hpZero: 0,
    canvasW: COV_W,
    canvasH: COV_H,
    covHeight: COV_H,
    covYOffset: COV_INSET,
    covTop: 0,
    regionMaxDepth: 100,
    depthDomainMax: 100,
    depthDomainMin: 0,
    coverageSymlogConstant: 1,
    binSize: BIN_BP,
    interbaseHeight: 0,
    snpMinFreq: 0,
    reversed: 0,
    coverageScaleType: 0,
    colorCoverage: abgr(COVERAGE),
    colorBaseA: 0,
    colorBaseC: 0,
    colorBaseG: 0,
    colorBaseT: 0,
    colorBaseN: 0,
    colorInsertionIndicator: 0,
    colorSoftclipIndicator: 0,
    colorHardclipIndicator: 0,
  }),
  reference: paintOver(bins.map(b => coverageBarShape(b.position, b.depth))),
})

// --- reads ---

const READ_W = 200
const READ_H = 36
const READ_BP_PER_PX = 0.37
const FEAT_H = 7
const FEAT_SPACING = 1
const readBp = (px: number) => Math.round(START + px * READ_BP_PER_PX)
const readPx = (b: number) => (b - START) / READ_BP_PER_PX

// [left px, right px, row, strand]: fractional ends, a sub-pixel read, both caps
const READS = [
  [3.3, 60.6, 0, 1],
  [80.2, 150.9, 0, -1],
  [12.7, 13.2, 1, 1],
  [30.4, 120.1, 1, 1],
  [140.6, 190.3, 1, -1],
  [20.1, 95.5, 2, -1],
  [110.8, 170.4, 2, 1],
  [5.5, 185.2, 3, 1],
] as const

// read.slang's distance from a point to one slanted edge of the cap; the
// generated twin keeps it private behind `chevronContains`.
function chevronEdgeDistPx(dx: number, dy: number, featHeight: number) {
  const halfH = featHeight * 0.5
  return (
    (CHEVRON_PX * halfH - halfH * dx - CHEVRON_PX * dy) /
    Math.hypot(halfH, CHEVRON_PX)
  )
}

function placeRead([l, r, row, strand]: (typeof READS)[number]) {
  const x1 = readPx(readBp(l))
  const x2 = extendToMinWidthPx(x1, readPx(readBp(r)), 1)
  const top = row * (FEAT_H + FEAT_SPACING)
  const rgb = strand > 0 ? FWD : REV
  return {
    x1,
    x2,
    top,
    bottom: top + FEAT_H,
    mid: top + FEAT_H / 2,
    strand,
    outlined: x2 - x1 > read.READ_OUTLINE_MIN_WIDTH_PX,
    fill: rgba(rgb),
    shade: rgba([
      rgb[0] * read.READ_OUTLINE_SHADE,
      rgb[1] * read.READ_OUTLINE_SHADE,
      rgb[2] * read.READ_OUTLINE_SHADE,
    ]),
  }
}

const placedReads = READS.map(placeRead)

// Distance in px to the read's edge that carries its outline, or undefined
// off the read. The body hands the side the cap joins to the cap.
function readEdgeDistPx(p: ReturnType<typeof placeRead>, x: number, y: number) {
  const capDx = p.strand > 0 ? x - p.x2 : p.x1 - x
  return box(p.x1, p.top, p.x2, p.bottom)(x, y)
    ? Math.min(
        p.strand < 0 ? Infinity : x - p.x1,
        p.strand > 0 ? Infinity : p.x2 - x,
        y - p.top,
        p.bottom - y,
      )
    : chevronContains(capDx, y - p.mid, FEAT_H)
      ? Math.min(
          chevronEdgeDistPx(capDx, y - p.mid, FEAT_H),
          chevronEdgeDistPx(capDx, p.mid - y, FEAT_H),
        )
      : undefined
}

// Reads never overlap here, so the last one a point falls on is its color.
function readColorAt(x: number, y: number) {
  let out = CLEAR
  for (const p of placedReads) {
    const edge = readEdgeDistPx(p, x, y)
    if (edge !== undefined) {
      out = p.outlined && edge < read.READ_OUTLINE_PX ? p.shade : p.fill
    }
  }
  return out
}

const readFixture = defineFixture({
  name: 'alignments-read',
  slang: `${SHADERS}/read.slang`,
  about: `pileup reads ${FEAT_H} px tall with chevron caps and the 1 px inner outline, fractional ends at ${(1 / READ_BP_PER_PX).toFixed(2)} px/bp`,
  mod: read,
  width: READ_W,
  height: READ_H,
  count: READS.length,
  instances: {
    startOff: READS.map(r => readBp(r[0])),
    endOff: READS.map(r => readBp(r[1])),
    y: READS.map(r => r[2]),
    flags: READS.map(() => 0),
    insertSize: READS.map(() => 0),
    strand: READS.map(r => r[3]),
    fillColor: READS.map(() => 0),
    edgeFlags: READS.map(() => 3),
    interchrom: READS.map(() => 0),
    colorCategory: READS.map(r =>
      r[3] > 0 ? read.RC_FWD_STRAND : read.RC_REV_STRAND,
    ),
  },
  uniforms: () =>
    pileupUniforms(READ_W, READ_H, READ_BP_PER_PX, FEAT_H, FEAT_SPACING),
  reference: readColorAt,
})

// --- mismatches ---

const MM_W = 160
const MM_H = 24
const LETTERS = ['A', 'C', 'G', 'T'] as const

function mismatchFixture(name: string, bpPerPx: number, about: string) {
  const mmPx = (b: number) => (b - START) / bpPerPx
  const span = MM_W * bpPerPx
  const cells = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 24 }, (_, i) => ({
      position: START + Math.floor(((i + 0.37 * row) * span) / 24),
      row,
      letter: LETTERS[(i * 7 + row * 3) % 4]!,
    })),
  ).flat()
  const shapes: Shape[] = cells.map(c => {
    const left = Math.round(mmPx(c.position))
    const right = extendToMinWidthPx(left, Math.round(mmPx(c.position + 1)), 1)
    const top = c.row * (FEAT_H + FEAT_SPACING)
    return {
      inside: box(left, top, right, top + FEAT_H),
      color: rgba(BASE[c.letter]!),
      bounds: [left, top, right, top + FEAT_H],
    }
  })
  return defineFixture({
    name,
    slang: `${SHADERS}/mismatch.slang`,
    about,
    mod: mismatch,
    width: MM_W,
    height: MM_H,
    count: cells.length,
    instances: {
      position: cells.map(c => c.position),
      y: cells.map(c => c.row),
      base: cells.map(c => c.letter.charCodeAt(0)),
      frequency: cells.map(() => 1),
      qual: cells.map(() => mismatch.QUAL_UNAVAILABLE),
    },
    uniforms: () => pileupUniforms(MM_W, MM_H, bpPerPx, FEAT_H, FEAT_SPACING),
    reference: paintOver(shapes),
  })
}

export default [
  coverageBarFixture,
  readFixture,
  mismatchFixture(
    'alignments-mismatch',
    0.37,
    'opaque 1 bp mismatch cells, edges on whole CSS px, 2.70 px/bp',
  ),
  mismatchFixture(
    'alignments-mismatch-subpixel',
    1.6,
    'opaque 1 bp mismatch cells under a pixel wide (0.62 px/bp), floored to 1 CSS px',
  ),
]
