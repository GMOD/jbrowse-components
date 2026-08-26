import {
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { filterChainFeatures } from '../RenderAlignmentDataRPC/executeRenderAlignmentData.ts'
import { isConcordantPairRead } from './buildBaseFeatureData.ts'
import { defaultFilterFlags } from './util.ts'

import type { Feature } from '@jbrowse/core/util'

// "Proper pairs" hides the reads; "Show concordant-pair arcs" hides their
// arcs. They are two settings in two menus computed on two sides of the worker
// boundary — one over `Feature`s, one over `readFlags`/`readPairOrientations` —
// and the only thing making them agree is that both call
// `isConcordantPairRead`.
//
// That is exactly the shape a "these must match" comment used to stand in for,
// so this holds the READ filter's real answer against the predicate rather than
// against a restatement of it. If someone re-implements either side, the pair a
// user sees hidden as a read but drawn as an arc is the bug, and it is silent.
function feature(
  id: string,
  flags: number,
  pairOrientation: string | undefined,
): Feature {
  const fields: Record<string, unknown> = {
    start: 100,
    end: 200,
    flags,
    name: id,
    pair_orientation: pairOrientation,
  }
  return {
    id: () => id,
    get: (k: string) => fields[k],
  } as unknown as Feature
}

// The orientation strings the worker actually sees, paired with the numeric
// encoding the arc side holds (PAIR_DIRECTION_NUM). Both spellings of each case
// go through their own side's entry point below.
const CASES = [
  {
    name: 'flagged proper, FR',
    flags: SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR,
    str: 'F1R2',
    num: 1,
  },
  {
    name: 'flagged proper, RL',
    flags: SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR,
    str: 'R1F2',
    num: 2,
  },
  {
    name: 'flagged proper, RR',
    flags: SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR,
    str: 'R1R2',
    num: 3,
  },
  {
    name: 'flagged proper, LL',
    flags: SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR,
    str: 'F1F2',
    num: 4,
  },
  {
    name: 'flagged proper, unknown orientation',
    flags: SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR,
    str: undefined,
    num: 0,
  },
  {
    name: 'not flagged proper, FR',
    flags: SAM_FLAG_PAIRED,
    str: 'F1R2',
    num: 1,
  },
  {
    name: 'flagged proper but supplementary',
    flags: SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR | SAM_FLAG_SUPPLEMENTARY,
    str: 'F1R2',
    num: 1,
  },
  {
    name: 'flagged proper but secondary',
    flags: SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR | SAM_FLAG_SECONDARY,
    str: 'F1R2',
    num: 1,
  },
]

describe.each(CASES)('$name', ({ flags, str, num }) => {
  // What the READ filter does with a lone pair of this kind: `properPairs:
  // 'exclude'` drops a chain only when the chain is the ordinary case, so an
  // empty result means "the read filter calls this concordant".
  const hiddenAsRead =
    filterChainFeatures([feature('r', flags, str), feature('r', flags, str)], {
      ...defaultFilterFlags,
      properPairs: 'exclude',
    }).length === 0

  test('the arc predicate agrees with the read filter', () => {
    expect(isConcordantPairRead(flags, num)).toBe(hiddenAsRead)
  })
})
