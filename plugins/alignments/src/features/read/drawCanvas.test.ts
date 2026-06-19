import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { drawReads, showChevron } from './drawCanvas.ts'
import { ColorScheme } from '../../LinearAlignmentsDisplay/constants.ts'

import type { ChevronFrame } from './drawCanvas.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ColorPalette } from '../../LinearAlignmentsDisplay/shaders/colors.ts'

const BLACK: [number, number, number] = [0, 0, 0]
const palette = {
  colorFwdStrand: [1, 0, 0],
  colorRevStrand: [0, 0, 1],
  colorNostrand: BLACK,
  colorPairLR: [0, 0.5, 0],
  colorPairRL: BLACK,
  colorPairRR: BLACK,
  colorPairLL: BLACK,
  colorBaseA: BLACK,
  colorBaseC: BLACK,
  colorBaseG: BLACK,
  colorBaseT: BLACK,
  colorBaseN: BLACK,
  colorInsertion: BLACK,
  colorDeletion: BLACK,
  colorSkip: BLACK,
  colorSoftclip: BLACK,
  colorHardclip: BLACK,
  colorInsertionIndicator: BLACK,
  colorSoftclipIndicator: BLACK,
  colorHardclipIndicator: BLACK,
  colorCoverage: BLACK,
  colorModificationFwd: BLACK,
  colorModificationRev: BLACK,
  colorMutedSnpBase: BLACK,
  colorLongInsert: BLACK,
  colorShortInsert: BLACK,
  colorSupplementary: BLACK,
  colorUnmappedMate: BLACK,
  colorInterchrom: BLACK,
} satisfies ColorPalette

interface ReadSpec {
  start: number
  end: number
  strand: number
  flags?: number
  interchrom?: number
  insertSize?: number
}

function makeRegion(reads: ReadSpec[]) {
  const n = reads.length
  const readPositions = new Uint32Array(n * 2)
  const readStrands = new Int8Array(n)
  const readFlags = new Uint16Array(n)
  const readInterchrom = new Uint8Array(n)
  const readInsertSizes = new Float32Array(n)
  for (const [i, r] of reads.entries()) {
    readPositions[i * 2] = r.start
    readPositions[i * 2 + 1] = r.end
    readStrands[i] = r.strand
    readFlags[i] = r.flags ?? 0
    readInterchrom[i] = r.interchrom ?? 0
    readInsertSizes[i] = r.insertSize ?? 0
  }
  return {
    readPositions,
    readYs: new Uint16Array(n),
    readStrands,
    readFlags,
    readPairOrientations: new Uint8Array(n),
    readTagColors: new Uint32Array(n),
    readMapqs: new Uint8Array(n),
    readInsertSizes,
    readChainHasSupp: undefined,
    readInterchrom,
  }
}

// bpLength = 100; fullBlockWidth controls pxPerBp (default 1000 → 10 px/bp).
// featureHeight 10 at row 0 with no offsets keeps the row at y=0, yMid=5.
function draw(
  reads: ReadSpec[],
  state: Partial<RenderState> = {},
  fullBlockWidth = 1000,
) {
  const ctx = new SvgCanvas()
  const block: DrawBlock = { start: 0, end: 100, screenStartPx: 0 }
  drawReads(ctx, makeRegion(reads), block, 100, fullBlockWidth, {
    featureHeight: 10,
    featureSpacing: 0,
    pileupTopOffset: 0,
    scrollTop: 0,
    linkedReads: 'off',
    colorScheme: ColorScheme.strand,
    colors: palette,
    showOutline: false,
    ...state,
  } as unknown as RenderState)
  return ctx.getSerializedSvg()
}

// Read bp [10,50] at 10 px/bp → body screen span [100,500].
const wideFwd = { start: 10, end: 50, strand: 1 }
const wideRev = { start: 10, end: 50, strand: -1 }

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
    colorScheme: ColorScheme.normal,
  })
  expect(svg).toContain('<rect')
  expect(svg).not.toContain('<path')
})

test('direction-moot wide read (normal scheme) still gets an arrowhead', () => {
  const svg = draw([wideFwd], { colorScheme: ColorScheme.normal })
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

// Independent reimplementation of read.slang `showChev`, kept separate so a
// change to one side of the SYNC contract trips this grid.
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
