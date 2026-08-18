import {
  arcColorLegendCategory,
  getArcColorType,
} from '../features/arcs/arcColors.ts'
import { readColorCategory } from './colorUtils.ts'
import { ColorScheme } from './constants.ts'

import type { ArcColorByType } from '../shared/types.ts'

// The arc overlay and the read fills classify a pair INDEPENDENTLY —
// `getArcColorType` on one side, `readColorCategory` on the other — and the
// model folds the arc key into the read key whenever the two schemes are
// twins, which renders an arc bucket as a plain read swatch and drops the
// curve mark. That fold is an assertion that the two classifiers agree, and
// nothing held them to it: a figure shipped with red arcs over grey reads.
//
// This file is the missing half. Both sides now classify TLEN and nothing else,
// so the agreement is total and this pins it that way.

const stats = { upper: 600, lower: 100 }

// pairOrientationToNum: 1=LR/normal, 2=RL, 3=RR, 4=LL.
const ORIENTATIONS = [1, 2, 3, 4]
// straddles classifyInsertSize's lower/upper against `stats`
const INSERT_SIZES = [50, 300, 5000]

const ARC_TO_READ_SCHEME: Record<ArcColorByType, number> = {
  insertSize: ColorScheme.insertSize,
  orientation: ColorScheme.pairOrientation,
  insertSizeAndOrientation: ColorScheme.insertSizeAndOrientation,
}

function arcCategory(
  colorByType: ArcColorByType,
  pairOrientationNum: number,
  tlen: number,
) {
  return arcColorLegendCategory(
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
      },
      colorByType,
      hasPaired: true,
      stats,
    }),
    colorByType,
  )
}

function readCategory(
  colorByType: ArcColorByType,
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
    ARC_TO_READ_SCHEME[colorByType],
  )
}

describe('arc and read color classifiers', () => {
  test.each(Object.keys(ARC_TO_READ_SCHEME) as ArcColorByType[])(
    'agree on every orientation x insert-size pair in %s mode',
    colorByType => {
      for (const po of ORIENTATIONS) {
        for (const tlen of INSERT_SIZES) {
          expect([
            colorByType,
            po,
            tlen,
            arcCategory(colorByType, po, tlen),
          ]).toEqual([
            colorByType,
            po,
            tlen,
            readCategory(colorByType, po, tlen),
          ])
        }
      }
    },
  )

  // TLEN 0 is the case the two classifiers used to split on, and the reason a
  // figure shipped with red arcs over grey reads. `classifyInsertSize` sorts it
  // into `normal` (0 is neither > upper nor inside (0, lower)), so the reads
  // painted it as an ordinary pair; the arcs measured the mates' drawn distance
  // instead and painted it long-insert. The arcs read TLEN now, so an
  // information-unavailable pair is `normal` on both sides rather than red on
  // one of them.
  test('agree on TLEN 0, however far apart the mates are drawn', () => {
    for (const colorByType of Object.keys(
      ARC_TO_READ_SCHEME,
    ) as ArcColorByType[]) {
      expect(arcCategory(colorByType, 1, 0)).toBe(
        readCategory(colorByType, 1, 0),
      )
    }
  })

  // `orientation` mode has no insert-size vocabulary at all on the read side,
  // so an arc keying an insert bucket there is unfoldable into the read key —
  // which is exactly what the long-insert LR fallback used to produce.
  test('orientation mode never emits an insert-size bucket', () => {
    for (const po of ORIENTATIONS) {
      for (const tlen of [0, ...INSERT_SIZES]) {
        expect(['longInsert', 'shortInsert', 'normalInsert']).not.toContain(
          arcCategory('orientation', po, tlen),
        )
      }
    }
  })
})
