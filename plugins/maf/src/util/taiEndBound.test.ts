import BgzipMafAdapter from '../BgzipMafAdapter/BgzipMafAdapter.ts'
import bgzipMafConfigSchema from '../BgzipMafAdapter/configSchema.ts'
import BgzipTaffyAdapter from '../BgzipTaffyAdapter/BgzipTaffyAdapter.ts'
import bgzipTaffyConfigSchema from '../BgzipTaffyAdapter/configSchema.ts'
import { queryBlockSpan } from './taiIndex.ts'
import { readTaiIndex } from './taiSlice.ts'
import { queriesDifferingFromWholeChromosome } from './taiWholeChromosome.fixture.ts'

import type { MafAdapterBase } from './MafAdapterBase.ts'

const local = (name: string) => ({
  localPath: require.resolve(`../../test_data/${name}`),
  locationType: 'LocalPathLocation' as const,
})

const taf = () =>
  new BgzipTaffyAdapter(
    bgzipTaffyConfigSchema.create({
      tafGzLocation: local('celegans/chrI.taf.gz'),
      taiLocation: local('celegans/chrI.taf.gz.tai'),
    }),
  )

const maf = () =>
  new BgzipMafAdapter(
    bgzipMafConfigSchema.create({
      mafGzLocation: local('celegans/ce10Slice.maf.gz'),
      taiLocation: local('celegans/ce10Slice.maf.gz.tai'),
    }),
  )

function queriesAround(starts: number[], dataEnd: number) {
  const every = Math.max(1, Math.floor(starts.length / 6))
  const lastStart = starts.at(-1)!
  const sampled = [
    ...starts.filter((_, i) => i % every === 0),
    starts.at(-2)!,
    lastStart,
  ]
  const spans: [number, number][] = [
    [dataEnd - 1, dataEnd],
    [dataEnd - 5000, dataEnd],
    [dataEnd, dataEnd + 1000],
    [lastStart, dataEnd],
    [lastStart + 1, dataEnd + 1000],
    [0, 1],
    [0, starts[0]!],
    [0, starts[1]!],
    [starts[0]!, starts[0]! + 1],
  ]
  for (const s of sampled) {
    spans.push(
      [s, s + 1],
      [s - 1, s],
      [s - 1, s + 1],
      [s, s + 400],
      [s + 1, s + 401],
      [s - 400, s],
      [s - 400, s + 400],
      [s - 5000, s],
      [s + 1, s + 1 + 2 * (starts[1]! - starts[0]!)],
    )
  }
  for (let i = 0; i + 5 < starts.length; i += every * 3) {
    spans.push(
      [starts[i]! + 1, starts[i + 5]!],
      [starts[i]! + 1, starts[i + 5]! + 1],
      [starts[i]! - 1, starts[i + 3]! - 1],
    )
  }
  return spans.filter(([start, end]) => start >= 0 && end > start)
}

async function boundedReadsDifferFromWholeChromosome(
  adapter: MafAdapterBase,
  taiName: string,
) {
  const { index } = await readTaiIndex(local(taiName))
  const starts = index.get('chrI')!.map(r => r.start)
  return queriesDifferingFromWholeChromosome(adapter, 'chrI', dataEnd =>
    queriesAround(starts, dataEnd),
  )
}

describe('a bounded .tai read returns what a whole-chromosome read has in the query', () => {
  test('TAF, celegans chrI', async () => {
    const result = await boundedReadsDifferFromWholeChromosome(
      taf(),
      'celegans/chrI.taf.gz.tai',
    )
    expect(result.differing).toEqual([])
    expect(result.queries).toBeGreaterThan(80)
    expect(result.nonEmpty).toBeGreaterThan(result.queries / 2)
  }, 120_000)

  test('bgzip MAF, a 100 kb slice of celegans chrI', async () => {
    const result = await boundedReadsDifferFromWholeChromosome(
      maf(),
      'celegans/ce10Slice.maf.gz.tai',
    )
    expect(result.differing).toEqual([])
    expect(result.features).toBeGreaterThan(100)
    expect(result.queries).toBeGreaterThan(50)
    expect(result.nonEmpty).toBeGreaterThan(result.queries / 2)
  }, 120_000)
})

describe('the read is bounded at the first entry at or past the query end', () => {
  test('a query ending on an entry start stops at that entry', async () => {
    const { index } = await readTaiIndex(local('celegans/chrI.taf.gz.tai'))
    const records = index.get('chrI')!
    const at = records[100]!
    const ending = queryBlockSpan(index, 'chrI', at.start - 400, at.start)!
    expect(ending.boundEntry).toBe(at)
    expect(ending.endBlock).toBe(at.virtualOffset.blockPosition)
    const crossing = queryBlockSpan(
      index,
      'chrI',
      at.start - 400,
      at.start + 1,
    )!
    expect(crossing.boundEntry).toBe(records[101])
  })

  test('a query past the last entry reads to the end of the chromosome', async () => {
    const { index } = await readTaiIndex(local('celegans/chrI.taf.gz.tai'))
    const last = index.get('chrI')!.at(-1)!
    const span = queryBlockSpan(index, 'chrI', last.start + 1, last.start + 10)!
    expect(span.boundEntry).toBeUndefined()
    expect(span.toEnd).toBe(true)
  })
})
