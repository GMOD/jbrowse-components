import { SimpleFeature } from '@jbrowse/core/util'

import type { LdToIndex } from './ldToIndex.ts'

export const testLd: LdToIndex = {
  r2ByKey: new Map([
    ['rsB', 0.9],
    ['chr1:200', 0.9],
    ['chr1:300', 0.3],
  ]),
  indexFound: true,
}

export function feat(p: { name?: string; start: number; svtype?: string }) {
  return new SimpleFeature({
    uniqueId: String(p.start),
    refName: 'chr1',
    start: p.start,
    end: p.start + 1,
    ...(p.name === undefined ? {} : { name: p.name }),
    ...(p.svtype === undefined ? {} : { svtype: p.svtype }),
  })
}
