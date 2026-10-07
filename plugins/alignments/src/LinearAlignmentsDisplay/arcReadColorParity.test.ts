import { getArcColorType } from '../features/arcs/arcColors.ts'
import { arcSlotCategory } from '../shaders/palettes.ts'
import { ARC_COLOR_FIELDS } from '../shared/arcColorOptions.ts'
import { readColorCategory, swatchPaletteKeys } from './colorUtils.ts'

import type { ArcColorField } from '../shared/types.ts'

// The arc overlay and the read fills classify a pair through one function
// (`pairCategory`), and the model folds the arc key into the read key whenever
// the two schemes are twins, which renders an arc bucket as a plain read swatch
// and drops the curve mark. This pins what the fold assumes: the arc side's
// own gates (`hasPaired`, `isSplit`) and its category-to-slot fold leave a
// paired arc keyed as the reads under it are. A figure once shipped with red
// arcs over grey reads when the two sides classified separately.

const stats = { upper: 600, lower: 100 }

// pairOrientationToNum: 1=LR/normal, 2=RL, 3=RR, 4=LL.
const ORIENTATIONS = [1, 2, 3, 4]
// straddles classifyInsertSize's lower/upper against `stats`
const INSERT_SIZES = [50, 300, 5000]

function arcCategory(
  colorField: ArcColorField,
  pairOrientationNum: number,
  tlen: number,
) {
  return arcSlotCategory(
    getArcColorType({
      arc: {
        isSplit: false,
        p1Ref: 'chr1',
        p1Bp: 0,
        p1Strand: 1,
        p2Ref: 'chr1',
        p2Bp: 1000,
        p2Strand: -1,
        // an FR pair's feet, which colouring never consults either
        p1Dir: 1,
        p2Dir: -1,
        pairOrientationNum,
        tlen,
        // carried for the concordant-arc filter, which colouring never consults
        flags: 0,
        stats,
      },
      colorField,
      hasPaired: true,
    }),
    colorField,
  )
}

function readCategory(
  colorField: ArcColorField,
  pairOrientationNum: number,
  tlen: number,
) {
  return readColorCategory(
    0,
    {
      readStrands: Int8Array.of(1),
      readFlags: Uint16Array.of(1),
      readMapqs: Uint8Array.of(0),
      readInsertSizes: Float32Array.of(tlen),
      readPairOrientations: Uint8Array.of(pairOrientationNum),
      readTagColors: Uint32Array.of(0),
      readChainHasSupp: Uint8Array.of(0),
      readInterchrom: Uint8Array.of(0),
      insertSizeStats: stats,
    },
    colorField,
  )
}

describe('arc and read color classifiers', () => {
  test.each(ARC_COLOR_FIELDS)(
    'agree on every orientation x insert-size pair in %s mode',
    colorField => {
      for (const po of ORIENTATIONS) {
        for (const tlen of INSERT_SIZES) {
          expect([
            colorField,
            po,
            tlen,
            arcCategory(colorField, po, tlen),
          ]).toEqual([colorField, po, tlen, readCategory(colorField, po, tlen)])
        }
      }
    },
  )

  // The second mate of a pair carries the negative TLEN. The reads used to
  // hand it to the classifier unsigned-as-is, so one mate of a long-insert
  // pair painted normal while the arc over both painted long.
  test('agree on a negative TLEN', () => {
    for (const colorField of ARC_COLOR_FIELDS) {
      for (const tlen of INSERT_SIZES) {
        expect(arcCategory(colorField, 1, -tlen)).toBe(
          readCategory(colorField, 1, -tlen),
        )
      }
    }
    expect(readCategory('insertSize', 1, -5000)).toBe('longInsert')
  })

  // TLEN 0 is SAM's "information unavailable": `classifyInsertSize` sorts it
  // into `normal`, so an unavailable pair is `normal` on both sides rather
  // than red on one of them.
  test('agree on TLEN 0, however far apart the mates are drawn', () => {
    for (const colorField of ARC_COLOR_FIELDS) {
      expect(arcCategory(colorField, 1, 0)).toBe(readCategory(colorField, 1, 0))
    }
  })

  // The arc palette has no `nonSplit` slot, so a pair with no orientation
  // folds onto the baseline, which the pairOrientation key names `pairLR`;
  // the two categories share a swatch, so the picture agrees.
  test('a pair with no orientation paints the same swatch on both sides', () => {
    for (const colorField of ARC_COLOR_FIELDS) {
      const arc = arcCategory(colorField, 0, 300)
      const read = readCategory(colorField, 0, 300)
      expect(swatchPaletteKeys[arc as keyof typeof swatchPaletteKeys]).toBe(
        swatchPaletteKeys[read as keyof typeof swatchPaletteKeys],
      )
    }
    expect(readCategory('pairOrientation', 0, 300)).toBe('nonSplit')
    expect(arcCategory('pairOrientation', 0, 300)).toBe('pairLR')
  })

  // `pairOrientation` mode has no insert-size vocabulary at all on the read side,
  // so an arc keying an insert bucket there is unfoldable into the read key —
  // which is exactly what the long-insert LR fallback used to produce.
  test('orientation mode never emits an insert-size bucket', () => {
    for (const po of ORIENTATIONS) {
      for (const tlen of [0, ...INSERT_SIZES]) {
        expect(['longInsert', 'shortInsert', 'normalInsert']).not.toContain(
          arcCategory('pairOrientation', po, tlen),
        )
      }
    }
  })
})
