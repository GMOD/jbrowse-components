import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { blockOverlaps } from './MafTaiAdapterBase.ts'

import type { MafAdapterBase } from './MafAdapterBase.ts'

const wholeChromosomeEnd = 2 ** 31 - 1

async function describeFeatures(
  adapter: MafAdapterBase,
  refName: string,
  start: number,
  end: number,
) {
  const features = await firstValueFrom(
    adapter
      .getFeatures({ assemblyName: 'test', refName, start, end })
      .pipe(toArray()),
  )
  return features.map(f => ({
    start: f.get('start'),
    end: f.get('end'),
    id: f.id(),
  }))
}

/**
 * Each query's features against what a read of the whole chromosome has in the
 * query. The whole read has no bounding entry, so it is the oracle for what a
 * bounded read must not lose.
 */
export async function queriesDifferingFromWholeChromosome(
  adapter: MafAdapterBase,
  refName: string,
  makeQueries: (dataEnd: number) => [number, number][],
) {
  const whole = await describeFeatures(adapter, refName, 0, wholeChromosomeEnd)
  const dataEnd = Math.max(...whole.map(f => f.end))
  const queries = makeQueries(dataEnd)
  const differing: string[] = []
  let nonEmpty = 0
  for (const [start, end] of queries) {
    const expected = whole.filter(f =>
      blockOverlaps(f.start, f.end, { start, end }),
    )
    const got = await describeFeatures(adapter, refName, start, end)
    nonEmpty += got.length > 0 ? 1 : 0
    if (JSON.stringify(got) !== JSON.stringify(expected)) {
      differing.push(`${start}-${end}: ${got.length} vs ${expected.length}`)
    }
  }
  return {
    differing,
    nonEmpty,
    queries: queries.length,
    features: whole.length,
  }
}
