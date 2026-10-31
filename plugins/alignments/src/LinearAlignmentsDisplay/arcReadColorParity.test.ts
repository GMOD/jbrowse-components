import { getArcColorType } from '../features/arcs/arcColors.ts'
import { arcSlotCategory } from '../shaders/palettes.ts'
import { readColorCategory, swatchPaletteKeys } from './colorUtils.ts'

// The arc overlay and the read fills classify a pair through one function
// (`pairCategory`), and the model folds the arc key into the read key whenever
// the two share a color, which renders an arc bucket as a plain read swatch
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
  pairOrientationNum: number,
  tlen: number,
  interchrom = false,
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
        // an FR pair's feet, which coloring never consults either
        p1Dir: 1,
        p2Dir: -1,
        pairOrientationNum,
        tlen,
        interchrom,
        // carried for the concordant-arc filter, which coloring never consults
        flags: 0,
        stats,
      },
      hasPaired: true,
    }),
  )
}

function readCategory(
  pairOrientationNum: number,
  tlen: number,
  interchrom = false,
) {
  return readColorCategory(
    0,
    {
      readStrands: Int8Array.of(1),
      readFlags: Uint16Array.of(1),
      readMapqs: Uint8Array.of(0),
      readInsertSizes: Float32Array.of(tlen),
      readPairOrientations: Uint8Array.of(pairOrientationNum),
      readFillColors: Uint32Array.of(0),
      readChainHasSupp: Uint8Array.of(0),
      readInterchrom: Uint8Array.of(interchrom ? 1 : 0),
      insertSizeStats: stats,
    },
    'insertSizeAndOrientation',
  )
}

describe('arc and read color classifiers', () => {
  test('agree on every orientation x insert-size pair', () => {
    for (const po of ORIENTATIONS) {
      for (const tlen of INSERT_SIZES) {
        expect([po, tlen, arcCategory(po, tlen)]).toEqual([
          po,
          tlen,
          readCategory(po, tlen),
        ])
      }
    }
  })

  // The second mate of a pair carries the negative TLEN. The reads used to
  // hand it to the classifier unsigned-as-is, so one mate of a long-insert
  // pair painted normal while the arc over both painted long.
  test('agree on a negative TLEN', () => {
    for (const tlen of INSERT_SIZES) {
      expect(arcCategory(1, -tlen)).toBe(readCategory(1, -tlen))
    }
    expect(readCategory(1, -5000)).toBe('longInsert')
  })

  // A translocated mate's supplementary can be drawn beside its partner, so
  // both ends of the arc share a chromosome while the pair's fields say the
  // mates do not.
  test('agree on a pair whose mates lie on two chromosomes', () => {
    for (const po of ORIENTATIONS) {
      expect(arcCategory(po, 0, true)).toBe(readCategory(po, 0, true))
    }
    expect(arcCategory(2, 0, true)).toBe('interchrom')
  })

  // TLEN 0 is SAM's "information unavailable": `classifyInsertSize` sorts it
  // into `normal`, so an unavailable pair is `normal` on both sides rather
  // than red on one of them.
  test('agree on TLEN 0, however far apart the mates are drawn', () => {
    expect(arcCategory(1, 0)).toBe(readCategory(1, 0))
  })

  // A pair with no computed orientation takes its insert class on both sides.
  test('a pair with no orientation paints the same swatch on both sides', () => {
    const arc = arcCategory(0, 300)
    const read = readCategory(0, 300)
    expect(swatchPaletteKeys[arc as keyof typeof swatchPaletteKeys]).toBe(
      swatchPaletteKeys[read as keyof typeof swatchPaletteKeys],
    )
    expect(read).toBe('normalInsert')
  })
})
