import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BedpeAdapter from './BedpeAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter() {
  return new BedpeAdapter(
    configSchema.create({
      bedpeLocation: {
        localPath: require.resolve('./test_data/test.bedpe'),
        locationType: 'LocalPathLocation',
      },
    }),
  )
}
// juicer's Arrowhead output, which is what the Hi-C tutorial loads as a contact
// domain track: '.' in the standard name and score columns, and the corner score
// the caller ranks its calls by in column 12, also named `score`. Its last
// header line is juicer's version banner, so name resolution gives up on the
// file's own defline and `columnNames` is the only way to reach that column.
const ARROWHEAD_COLUMNS = [
  'chr1',
  'x1',
  'x2',
  'chr2',
  'y1',
  'y2',
  'name',
  'score',
  'strand1',
  'strand2',
  'color',
  'score',
  'uVarScore',
  'lVarScore',
  'upSign',
  'loSign',
]

function makeArrowheadAdapter(columnNames: string[] = []) {
  return new BedpeAdapter(
    configSchema.create({
      bedpeLocation: {
        localPath: require.resolve('./test_data/arrowhead.bedpe'),
        locationType: 'LocalPathLocation',
      },
      columnNames,
    }),
  )
}

async function firstArrowheadFeature(columnNames?: string[]) {
  const features = await firstValueFrom(
    makeArrowheadAdapter(columnNames)
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr1',
        start: 0,
        end: 10000,
      })
      .pipe(toArray()),
  )
  return features[0]!
}

test('a named score column past 10 is not shadowed by an unset column 8', async () => {
  const feature = await firstArrowheadFeature(ARROWHEAD_COLUMNS)
  // columns past 10 are unparsed, so this is the string as written
  expect(feature.get('score')).toBe('0.9421403213751463')
  expect(feature.get('uVarScore')).toBe('0.2224905')
})

test('unset name and score columns read as absent, not as "." and NaN', async () => {
  const feature = await firstArrowheadFeature()
  expect(feature.get('name')).toBeUndefined()
  expect(feature.get('score')).toBeUndefined()
})

test('basic', async () => {
  const adapter = makeAdapter()

  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr1',
        start: 0,
        end: 10000,
      })
      .pipe(toArray()),
  )

  expect(features).toHaveLength(3) // 2 primary features + 1 mate on chr1

  const firstFeature = features[0]!
  expect(firstFeature.get('refName')).toBe('chr1')
  expect(firstFeature.get('start')).toBe(1000)
  expect(firstFeature.get('end')).toBe(2000)
  expect(firstFeature.get('mate')).toEqual({
    refName: 'chr2',
    start: 3000,
    end: 4000,
    strand: -1,
  })
  expect(firstFeature.get('ALT')).toEqual(['<DUP>'])
})

test('gets correct reference sequence names', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames()
  expect(refNames).toEqual(['chr1', 'chr2', 'chr3'])
})

test('parses header correctly', async () => {
  const adapter = makeAdapter()
  const header = await adapter.getHeader()
  expect(header).toBe('#header line 1\n#header line 2')
})

test('handles features with different strands correctly', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr1',
        start: 4000,
        end: 7000,
      })
      .pipe(toArray()),
  )

  const feature = features.find(f => f.get('name') === 'SV2')
  expect(feature?.get('strand')).toBe(1) // +
  expect((feature?.get('mate') as { strand: number }).strand).toBe(1) // +
})

test('handles different SV types correctly', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr2',
        start: 0,
        end: 3000,
      })
      .pipe(toArray()),
  )

  const feature = features.find(f => f.get('name') === 'SV3')
  expect(feature?.get('ALT')).toEqual(['<TRA>'])
  expect(feature?.get('score')).toBe(70)
})

// A row is filed under BOTH of its contigs, and the half a query gets back is
// anchored at whichever end it asked about. The two halves have to be mirror
// images — same blocks, same strands, swapped — or a consumer reading a junction
// edge off the strand gets a different answer depending on which end the reader
// clicked. The strand columns used to stay put while the coordinate columns
// swapped, so the flipped half was anchored at one end carrying the other end's
// orientation.
test.each([
  { name: 'SV1', refNames: ['chr1', 'chr2'] },
  { name: 'SV3', refNames: ['chr2', 'chr3'] },
])('both halves of $name mirror each other', async ({ name, refNames }) => {
  const adapter = makeAdapter()
  const halves = await Promise.all(
    refNames.map(async refName => {
      const features = await firstValueFrom(
        adapter
          .getFeatures({
            assemblyName: 'volvox',
            refName,
            start: 0,
            end: 10000,
          })
          .pipe(toArray()),
      )
      const f = features.find(feat => feat.get('name') === name)!
      return {
        self: {
          refName: f.get('refName'),
          start: f.get('start'),
          end: f.get('end'),
          strand: f.get('strand'),
        },
        mate: f.get('mate'),
      }
    }),
  )

  expect(halves[1]!.mate).toEqual(halves[0]!.self)
  expect(halves[0]!.mate).toEqual(halves[1]!.self)
})

test('returns empty array for non-existent reference', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chrX',
        start: 0,
        end: 1000,
      })
      .pipe(toArray()),
  )
  expect(features).toHaveLength(0)
})
