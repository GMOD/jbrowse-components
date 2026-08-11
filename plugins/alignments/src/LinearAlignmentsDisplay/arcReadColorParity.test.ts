import {
  arcColorLegendCategory,
  getArcColorType,
} from '../features/arcs/compute.ts'
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
// So this file is the missing half. It pins the agreement where it is supposed
// to hold, and pins the ONE place it does not so that divergence stays
// deliberate rather than being rediscovered from a picture.

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
  { longRange = false } = {},
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
        pairOrientationNum,
        tlen,
      },
      colorByType,
      hasPaired: true,
      longRange,
      largeInsert: longRange,
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

  // The known divergence, asserted rather than left to be found in a figure.
  // `getArcColorType` folds a pair whose SPAN clears LARGE_INSERT_THRESHOLD into
  // the long-insert color on the ground that a discordant pair's TLEN is often
  // 0 or unreliable; `readColorCategory` reads TLEN alone and has no such rule.
  // A normal-TLEN pair drawn far apart is therefore a red arc over a read that
  // is not red, in every mode that can paint long insert.
  test('diverge on a long-range pair whose TLEN looks normal', () => {
    const tlen = 300 // inside [lower, upper], so TLEN alone says normal
    expect(readCategory('insertSizeAndOrientation', 1, tlen)).toBe(
      'normalInsert',
    )
    expect(arcCategory('insertSizeAndOrientation', 1, tlen)).toBe(
      'normalInsert',
    )
    expect(
      arcCategory('insertSizeAndOrientation', 1, tlen, { longRange: true }),
    ).toBe('longInsert')
  })

  // The sharper case, and the one that made the legend wrong: `orientation`
  // mode has no insert-size vocabulary at all on the read side, so this bucket
  // cannot be folded into a `pairOrientation` read key.
  test('orientation mode can emit a bucket pairOrientation reads never paint', () => {
    expect(arcCategory('orientation', 1, 300, { longRange: true })).toBe(
      'longInsert',
    )
    for (const po of ORIENTATIONS) {
      expect(readCategory('orientation', po, 300)).not.toBe('longInsert')
    }
  })
})
