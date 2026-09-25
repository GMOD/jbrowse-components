import { extendToMinWidthPx } from '@jbrowse/render-core/shaders/hpmath'

import { buildReadColorCategories } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { colorSchemeIndexFor } from '../../LinearAlignmentsDisplay/constants.ts'
import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { CHEVRON_PX } from '../../shaders/slang/readChevron.generated.ts'
import { READ_MARK } from './mark.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The read pentagon's geometry, Canvas2D against read.slang. Both floor the
// body to 1 CSS px, and the shader hangs its three cap vertices off the FLOORED
// edges (`sx1`/`sx2`) — the painter took its apex off the raw projection, so a
// segment under a pixel wide drew a head up to a pixel shorter than the one on
// screen. Sub-pixel is the only zoom at which those two edges differ, so a case
// at a normal zoom passes against either spelling.

const BLOCK_START = 1000
const BP_LENGTH = 800
const BLOCK_WIDTH = 200
const PX_PER_BP = BLOCK_WIDTH / BP_LENGTH
const FEATURE_HEIGHT = 10
const Y_MID = FEATURE_HEIGHT / 2

function block(reversed: boolean): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: BLOCK_START,
    end: BLOCK_START + BP_LENGTH,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
}

const state = {
  featureHeight: FEATURE_HEIGHT,
  featureSpacing: 0,
  pileupTopOffset: 0,
  scrollTop: 0,
  canvasHeight: 1000,
  showOutline: false,
  chainMode: false,
  colorScheme: colorSchemeIndexFor('strand'),
  colors: makeTestPalette({
    colorFwdStrand: [1, 0, 0],
    colorRevStrand: [0, 0, 1],
  }),
} as unknown as RenderState

function oneRead(start: number, end: number, strand: number) {
  const base = {
    readPositions: Uint32Array.from([start, end]),
    readYs: new Uint16Array(1),
    readStrands: Int8Array.from([strand]),
    readFlags: new Uint16Array(1),
    readPairOrientations: new Uint8Array(1),
    readTagColors: new Uint32Array(1),
    readMapqs: new Uint8Array(1),
    readInsertSizes: new Float32Array(1),
    readInterchrom: new Uint8Array(1),
    segmentPositions: Uint32Array.from([start, end]),
    segmentReadIndices: new Uint32Array(1),
    segmentEdgeFlags: Uint8Array.from([0b11]),
  }
  return {
    ...base,
    readColorCategories: buildReadColorCategories(base, 'strand'),
  }
}

// The polygon the painter traced, as its vertices rather than a bounding box,
// so the apex and the two body corners it springs from are each assertable.
function tracedPath(start: number, end: number, strand: number, rev: boolean) {
  const pts: [number, number][] = []
  const ctx = {
    set fillStyle(_v: string) {},
    get fillStyle() {
      return ''
    },
    beginPath() {
      pts.length = 0
    },
    moveTo(x: number, y: number) {
      pts.push([x, y])
    },
    lineTo(x: number, y: number) {
      pts.push([x, y])
    },
    closePath() {},
    fill() {},
    fillRect() {},
  } as unknown as Ctx2D
  READ_MARK.paintBlock(ctx, oneRead(start, end, strand), block(rev), state)
  return {
    apexX: pts.find(p => p[1] === Y_MID)![0],
    bodyXs: pts.filter(p => p[1] !== Y_MID).map(p => p[0]),
  }
}

// read.slang's vertex stage, in the unflipped CSS-px axis it builds in: the
// body floored off the start edge by the shader's own `extendToMinWidthPx`, the
// apex CHEVRON_PX beyond whichever edge `chevronCapsEdge` names, and `flipX`
// applied last as the block's mirror.
function shaderPentagon(
  start: number,
  end: number,
  capsEdge: number,
  rev: boolean,
) {
  const u1 = (start - BLOCK_START) * PX_PER_BP
  const u2 = extendToMinWidthPx(u1, (end - BLOCK_START) * PX_PER_BP, 1)
  const flip = (u: number) => (rev ? BLOCK_WIDTH - u : u)
  return {
    apexX: flip(capsEdge > 0 ? u2 + CHEVRON_PX : u1 - CHEVRON_PX),
    bodyXs: [flip(u1), flip(u2)],
  }
}

describe.each([
  ['1 bp (0.25 px)', 1001, 1002],
  ['3 bp (0.75 px)', 1001, 1004],
  ['40 bp (10 px)', 1001, 1041],
])('a segment of %s', (_label, start, end) => {
  test.each([
    ['forward read', 1, 1],
    ['reverse read', -1, -1],
  ])('%s matches the shader on both orientations', (_l, strand, capsEdge) => {
    for (const rev of [false, true]) {
      const drawn = tracedPath(start, end, strand, rev)
      const want = shaderPentagon(start, end, capsEdge, rev)
      expect(drawn.apexX).toBeCloseTo(want.apexX, 10)
      expect(Math.min(...drawn.bodyXs)).toBeCloseTo(
        Math.min(...want.bodyXs),
        10,
      )
      expect(Math.max(...drawn.bodyXs)).toBeCloseTo(
        Math.max(...want.bodyXs),
        10,
      )
    }
  })
})

// The head stays attached to the body it caps, which is what the raw-projection
// apex broke: a 1 bp read at 0.25 px/bp got a 7.25 px run here against the
// GPU's 8, so the two pentagons ended at different x.
test('the head is CHEVRON_PX beyond the floored body edge, not the raw one', () => {
  const { apexX, bodyXs } = tracedPath(1001, 1002, 1, false)
  expect(Math.max(...bodyXs)).toBeCloseTo(0.25 + 1, 10)
  expect(apexX - Math.max(...bodyXs)).toBeCloseTo(CHEVRON_PX, 10)
})

// `Math.sign(xEnd - xStart)` answered +1 for a span projecting to exactly zero,
// so the apex went right whatever the block did, while the shader builds
// unflipped and mirrors through `flipX`. The direction is the block's.
test('a span projecting to zero still points the block’s way', () => {
  const fwd = tracedPath(1000, 1000, 1, false)
  expect(fwd.apexX - Math.max(...fwd.bodyXs)).toBeCloseTo(CHEVRON_PX, 10)
  const rev = tracedPath(1000, 1000, 1, true)
  expect(Math.min(...rev.bodyXs) - rev.apexX).toBeCloseTo(CHEVRON_PX, 10)
})
