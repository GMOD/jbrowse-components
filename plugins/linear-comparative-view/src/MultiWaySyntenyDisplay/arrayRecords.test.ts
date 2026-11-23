import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR, withAbgrAlpha } from '@jbrowse/core/util/colorBits'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'

import { changeLabel, repeatsChip } from './laneHeader.ts'
import { groupFeatures, laneIndelsOf } from './layoutMultiWay.ts'
import { ribbonColorKey } from './legend.ts'
import { ribbonPaintOf } from './ribbonPaint.ts'

import type { RowFrame } from './layoutMultiWay.ts'

type Row = [
  type: 'match' | 'array',
  strand: number,
  start: number,
  end: number,
  mateStart: number,
  mateEnd: number,
  record: number,
  hapWalks?: number,
  refWalks?: number,
]

// What the display held for one lane, read from the pggb chrY walk file by
// the plugin's placement records, clipped to the fetch window
function lane(assemblyName: string, contig: string, rows: Row[]) {
  return groupFeatures(
    rows.map(
      (
        [
          type,
          strand,
          start,
          end,
          mateStart,
          mateEnd,
          record,
          hapWalks,
          refWalks,
        ],
        i,
      ) =>
        new SimpleFeature({
          uniqueId: `${assemblyName}-${i}`,
          recordId: `${assemblyName}-record-${record}`,
          syntenyId: `${assemblyName}-${i}`,
          refName: 'chrY',
          start,
          end,
          strand,
          assemblyName: 'hg38',
          ...(type === 'array' ? { type, hapWalks, refWalks } : {}),
          mate: {
            assemblyName,
            refName: contig,
            start: mateStart,
            end: mateEnd,
          },
        }),
    ),
  )
}

// HG00126#1 at chrY:18,500,000-18,800,000: type, strand, hg38 start, end, haplotype start, end, record, and an array's walks
const PALINDROME_HG00126: Row[] = [
  ['match', -1, 18328672, 18339374, 17933687, 17944389, 0],
  ['match', 1, 18328672, 18346436, 18695745, 18713509, 1],
  ['match', 1, 18354591, 18452944, 18721666, 18820022, 2],
  ['array', -1, 18452944, 18847408, 18822920, 19217599, 3, 1.7, 1.9],
  ['array', 1, 18452944, 18847408, 19220306, 19233868, 4, 1, 2.2],
  ['match', -1, 18450877, 18452944, 19234557, 19236624, 5],
]
// HG002#1 at chrY:23,900,000-24,200,000: type, strand, hg38 start, end, haplotype start, end, record, and an array's walks
const DAZ_HG002: Row[] = [
  ['array', 1, 24068377, 24068395, 24562400, 24562418, 0, 1, 5.1],
  ['array', 1, 24109602, 24123580, 24630451, 24630514, 1, 1, 5.2],
  ['match', -1, 24198698, 24199781, 24658512, 24659595, 2],
  ['match', -1, 24195853, 24197550, 24660745, 24662442, 3],
  ['array', -1, 24195849, 24195851, 24662442, 24662446, 4, 2, 3],
  ['match', -1, 24192312, 24195849, 24662446, 24665983, 5],
  ['array', -1, 24192297, 24192312, 24665983, 24665999, 6, 1.1, 2.1],
  ['match', -1, 24182575, 24192296, 24665999, 24675720, 7],
  ['match', -1, 24179059, 24179915, 24678380, 24679236, 8],
  ['match', -1, 24173573, 24174713, 24683592, 24684732, 9],
  ['match', -1, 24149026, 24153426, 24704878, 24709278, 10],
  ['match', -1, 24138730, 24146239, 24712065, 24719569, 11],
  ['array', 1, 24124202, 24124213, 24729371, 24729381, 12, 1, 8],
  ['array', -1, 24124529, 24128904, 24730885, 24734074, 13, 1, 2.6],
  ['array', -1, 24080752, 24096319, 24761964, 24777530, 14, 1, 2],
  ['match', -1, 24057222, 24058474, 24799809, 24801061, 15],
  ['match', -1, 24026846, 24031912, 24826377, 24831443, 16],
  ['match', -1, 24024366, 24024374, 24833953, 24833962, 17],
  ['match', -1, 23977242, 23977858, 24880443, 24881059, 18],
  ['match', -1, 23967039, 23974046, 24884248, 24891255, 19],
  ['match', -1, 23947005, 23953728, 24904557, 24911280, 20],
  ['match', -1, 23944351, 23945991, 24912294, 24913934, 21],
  ['match', -1, 23932936, 23943312, 24914972, 24925348, 22],
  ['match', -1, 23910992, 23921969, 24936312, 24947283, 23],
  ['match', -1, 23863082, 23864163, 24994115, 24995195, 24],
  ['array', 1, 24068377, 24068395, 26182332, 26182350, 25, 1, 5.1],
  ['match', -1, 24203683, 24206279, 26271950, 26274546, 26],
  ['match', -1, 24198698, 24199781, 26278450, 26279533, 27],
  ['match', -1, 24195853, 24197550, 26280684, 26282381, 28],
  ['array', -1, 24195849, 24195851, 26282381, 26282385, 29, 2, 3],
  ['match', -1, 24192312, 24195849, 26282385, 26285922, 30],
  ['array', -1, 24192297, 24192312, 26285922, 26285938, 31, 1.1, 2.1],
  ['match', -1, 24188809, 24192296, 26285938, 26289423, 32],
  ['match', -1, 24179059, 24179915, 26298317, 26299173, 33],
  ['match', -1, 24173573, 24174713, 26303525, 26304666, 34],
  ['match', -1, 24166962, 24168626, 26309613, 26311277, 35],
  ['match', -1, 24149026, 24153426, 26324813, 26329215, 36],
  ['match', -1, 24138730, 24146239, 26332002, 26339506, 37],
  ['match', -1, 24135889, 24136753, 26341480, 26342344, 38],
  ['array', 1, 24117272, 24135889, 26342344, 26361002, 39, 1.5, 4.1],
  ['match', 1, 24135889, 24136792, 26361002, 26361903, 40],
  ['array', -1, 24065188, 24114500, 26363733, 26364003, 41, 1, 7.7],
  ['array', -1, 24080752, 24103674, 26374559, 26397479, 42, 1, 2],
  ['array', -1, 24066650, 24066811, 26411420, 26411581, 43, 1, 8.1],
  ['array', -1, 24060869, 24066621, 26411610, 26412500, 44, 1, 8.7],
  ['match', -1, 24060635, 24060636, 26412500, 26412501, 45],
  ['match', -1, 24057222, 24058707, 26419524, 26421009, 46],
  ['match', -1, 24053466, 24055438, 26422792, 26424764, 47],
  ['match', -1, 24026846, 24031912, 26446317, 26451383, 48],
  ['match', -1, 24024366, 24024373, 26453892, 26453899, 49],
  ['match', -1, 23992553, 24007711, 26470527, 26485669, 50],
  ['match', -1, 23977153, 23981197, 26497026, 26501068, 51],
  ['match', -1, 23967039, 23974054, 26504167, 26511182, 52],
  ['match', -1, 23943694, 23964114, 26514107, 26534521, 53],
  ['match', -1, 23901326, 23943312, 26534904, 26576881, 54],
  ['match', -1, 23863082, 23898729, 26579479, 26615124, 55],
]
// HG002#1 at chrY:9,300,000-9,600,000: type, strand, hg38 start, end, haplotype start, end, record, and an array's walks
const TSPY_HG002: Row[] = [
  ['array', 1, 9337466, 9337564, 5922067, 5922165, 0, 1, 10],
  ['array', 1, 9528339, 9548489, 5922438, 5922497, 1, 1, 11],
  ['match', 1, 9568275, 9568281, 5940139, 5940144, 2],
  ['match', 1, 9568541, 9568553, 5940402, 5940414, 3],
  ['match', 1, 9665089, 9665102, 5981813, 5981825, 4],
  ['match', 1, 9595101, 9595110, 5989078, 5989087, 5],
  ['match', 1, 9164336, 9335800, 8766312, 8937801, 6],
  ['array', 1, 9335899, 9546670, 8937900, 8945589, 7, 1, 9.4],
  ['array', 1, 9343701, 9483100, 8945653, 8955594, 8, 1, 8.8],
  ['array', 1, 9345765, 9549193, 8955722, 8998966, 9, 2.1, 8.9],
  ['array', 1, 9337350, 9487761, 8999042, 9021299, 10, 1.1, 8.9],
  ['array', 1, 9337724, 9548832, 9021688, 9042385, 11, 1, 8.9],
  ['array', 1, 9337350, 9549193, 9043267, 9627961, 12, 28.8, 8.9],
  ['array', 1, 9337724, 9548832, 9628037, 9706393, 13, 3.9, 8.9],
  ['array', 1, 9353796, 9537233, 9706561, 9729457, 14, 1.1, 8.9],
  ['array', 1, 9340556, 9537233, 9729533, 9807365, 15, 3.8, 8.9],
  ['array', 1, 9335873, 9394891, 9807506, 9810684, 16, 1, 8.3],
  ['array', 1, 9336724, 9542128, 9811341, 9828227, 17, 1, 9],
  ['array', 1, 9353796, 9561044, 9828395, 9865601, 18, 1.1, 5],
  ['match', 1, 9561063, 9648302, 9865601, 9952842, 19],
  ['match', 1, 9648322, 9683072, 9952868, 9987611, 20],
  ['match', -1, 9596907, 9596940, 10132331, 10132364, 21],
  ['match', -1, 9654146, 9654148, 10148766, 10148768, 22],
  ['match', 1, 9574968, 9574979, 10178695, 10178706, 23],
  ['match', 1, 9596640, 9596641, 10180327, 10180328, 24],
  ['array', -1, 9336056, 9546676, 10204152, 10204167, 25, 1, 1.9],
  ['array', -1, 9525153, 9546512, 10204317, 10205486, 26, 1, 5.1],
  ['array', -1, 9534033, 9537756, 10213187, 10216911, 27, 1, 4.4],
]

function frameOf(
  refName: string,
  min: number,
  max: number,
  flipped: boolean,
): RowFrame {
  return {
    refName,
    min,
    max,
    flipped,
    fitMin: min,
    fitMax: max,
    alsoOn: [],
    alsoOnMore: 0,
    alsoAt: [],
  }
}

const canon = (refName: string) => refName

describe('an array record states no change', () => {
  test('the palindrome reads no insertion where a reversed array sits between two forward pieces', () => {
    const { changes, openings } = laneIndelsOf(
      lane('HG00126#1', 'JBHIKU010000040.1', PALINDROME_HG00126),
    )
    expect(
      [false, true].map(reversed =>
        changes('HG00126#1', 'JBHIKU010000040.1', reversed).map(changeLabel),
      ),
    ).toEqual([[], []])
    expect(openings('HG00126#1', 'JBHIKU010000040.1')).toEqual([])
  })

  test('a lone array of the other strand bounds the gap between two pieces of one record, on either strand', () => {
    const reversedArray: Row[] = [
      ['match', 1, 0, 40_000, 0, 40_000, 0],
      ['array', -1, 40_000, 440_000, 40_000, 440_000, 1, 1, 2],
      ['match', 1, 540_000, 580_000, 440_000, 480_000, 0],
    ]
    const forwardArray: Row[] = [
      ['match', -1, 540_000, 580_000, 0, 40_000, 0],
      ['array', 1, 40_000, 440_000, 40_000, 440_000, 1, 1, 2],
      ['match', -1, 0, 40_000, 440_000, 480_000, 0],
    ]
    for (const rows of [reversedArray, forwardArray]) {
      const { changes, openings } = laneIndelsOf(lane('L', 'ctg', rows))
      for (const reversed of [false, true]) {
        expect(changes('L', 'ctg', reversed)).toEqual([])
        expect(openings('L', 'ctg', reversed)).toEqual([])
      }
    }
  })

  test('P1/DAZ reads no inversion from a forward array in a lane drawn reversed', () => {
    const { changes } = laneIndelsOf(lane('HG002#1', 'chrY', DAZ_HG002))
    expect(
      changes('HG002#1', 'chrY', true).filter(c => c.kind === 'inversion'),
    ).toEqual([])
  })

  test('P1/DAZ reads no gap across an array or ending at one', () => {
    const groups = lane('HG002#1', 'chrY', DAZ_HG002)
    const arrays = DAZ_HG002.filter(row => row[0] === 'array')
    const { changes } = laneIndelsOf(groups)
    for (const reversed of [false, true]) {
      for (const change of changes('HG002#1', 'chrY', reversed)) {
        expect(
          arrays.filter(
            ([, , , , start, end]) =>
              start <= change.laneEnd && end >= change.at,
          ),
        ).toEqual([])
      }
    }
  })
})

describe("the header names a lane's arrays", () => {
  test('TSPY names its largest array, haplotype bp over hg38 bp, and counts the rest the frame meets', () => {
    const { repeats } = laneIndelsOf(lane('HG002#1', 'chrY', TSPY_HG002))
    expect(
      repeatsChip(
        {
          label: 'HG002#1',
          canon,
          frame: frameOf('chrY', 8_619_113, 10_116_957, false),
        },
        repeats('HG002#1', 'chrY'),
        'hg38',
      ),
    ).toEqual({
      text: '585 kb repeat over 212 kb, 11 more',
      title:
        'This stretch repeats: HG002#1 passes its sequence about 29 times and hg38 about 8.9 times, so no single ribbon is drawn.',
    })
  })

  test('the palindrome names its reversed array and how often each side walks it', () => {
    const { repeats } = laneIndelsOf(
      lane('HG00126#1', 'JBHIKU010000040.1', PALINDROME_HG00126),
    )
    expect(
      repeatsChip(
        {
          label: 'HG00126#1',
          canon,
          frame: frameOf('JBHIKU010000040.1', 18_795_445, 19_244_798, false),
        },
        repeats('HG00126#1', 'JBHIKU010000040.1'),
        'hg38',
      ),
    ).toEqual({
      text: '395 kb repeat over 394 kb, 1 more',
      title:
        'This stretch repeats: HG00126#1 passes its sequence about 1.7 times and hg38 about 1.9 times, so no single ribbon is drawn.',
    })
  })

  test('a lane with no array has no chip', () => {
    const { repeats } = laneIndelsOf(
      lane(
        'HG002#1',
        'chrY',
        DAZ_HG002.filter(row => row[0] === 'match'),
      ),
    )
    expect(
      repeatsChip(
        {
          label: 'HG002#1',
          canon,
          frame: frameOf('chrY', 26_278_602, 26_578_170, true),
        },
        repeats('HG002#1', 'chrY'),
        'hg38',
      ),
    ).toBeUndefined()
  })
})

describe('an array record paints apart', () => {
  const [forward, reverse, none] =
    UNIVERSAL_FIELD_PRESETS.strand.scale.range.map(c =>
      withAbgrAlpha(cssColorToABGR(c), 255),
    )

  test('painted by strand, a TSPY array of either strand takes the no-strand color and a match keeps its strand', () => {
    const groups = lane('HG002#1', 'chrY', TSPY_HG002)
    const records = groups.map(group => group.feature)
    const paint = ribbonPaintOf({
      records,
      field: 'strand',
      ribbonColor: 'grey',
      attributeRanges: {},
      opacity: { value: 1 },
      filter: [],
    })
    const forwardArray = records.find(
      r => r.get('type') === 'array' && r.get('strand') === 1,
    )!
    const reverseArray = records.find(
      r => r.get('type') === 'array' && r.get('strand') === -1,
    )!
    const match = records.find(r => r.get('type') === undefined)!
    expect([
      paint(forwardArray, 1),
      paint(reverseArray, -1),
      paint(match, 1),
      paint(match, -1),
    ]).toEqual([none, none, forward, reverse])
  })

  test('the ribbon key names the no-strand color only for a track holding an array', () => {
    const none = UNIVERSAL_FIELD_PRESETS.strand.scale.range[2]
    expect(
      ribbonColorKey('strand', {}, { against: 'hg38', repeats: true }).map(
        e => [e.label, e.color],
      ),
    ).toEqual([
      ['Same orientation as hg38', 'tomato'],
      ['Inverted vs hg38', 'cornflowerblue'],
      ['Repeat, copies not paired', none],
    ])
    expect(
      ribbonColorKey('strand', {}, { against: 'hg38' }).map(e => e.label),
    ).toEqual(['Same orientation as hg38', 'Inverted vs hg38'])
  })
})
