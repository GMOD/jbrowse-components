import { TabixIndexedFile } from '@gmod/tabix'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { buildCsFromCigarAndBubbles } from './bubbleCs.ts'

import type { BubbleEntry } from './bubbleCs.ts'
import type { MultiPairFeature } from '../MultiPairFeature.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Region } from '@jbrowse/core/util/types'

type BubbleRow = BubbleEntry & { start: number; end: number }

// Walk the per-feature CIGAR ops and the per-region bubble VCF in lockstep,
// then write a per-feature CS string + identity. Mutates `feat.cs` and
// `feat.identity` in place. Called only when bpPerPx is small enough that
// per-base bubble detail is renderable; the cheap pre-check (bubbles file
// configured + zoom small enough) lives in the caller.
export async function annotateFeaturesWithBubbleCs(args: {
  genomeRows: Map<string, MultiPairFeature[]>
  query: Region
  bubblesFile: TabixIndexedFile
  bubblesGenomeNames: string[]
  tabixRefName: string
  assemblyNameMap: Record<string, string>
  stopToken?: StopToken
}) {
  const {
    genomeRows,
    query,
    bubblesFile,
    bubblesGenomeNames,
    tabixRefName,
    assemblyNameMap,
    stopToken,
  } = args

  const genomeIdx = new Map<string, number>()
  for (let i = 0; i < bubblesGenomeNames.length; i++) {
    genomeIdx.set(bubblesGenomeNames[i]!, i)
  }

  const bubbles: BubbleRow[] = []
  const checker = createStopTokenChecker(stopToken)
  await bubblesFile.getLines(tabixRefName, query.start, query.end, {
    lineCallback: (line: string) => {
      checkStopToken2(checker)
      const cols = line.split('\t')
      const genomesA = new Set(
        (cols[7] ?? '')
          .split(',')
          .filter(s => s.length > 0)
          .map(Number),
      )
      const genomesB = new Set(
        (cols[8] ?? '')
          .split(',')
          .filter(s => s.length > 0)
          .map(Number),
      )
      bubbles.push({
        start: +cols[1]!,
        end: +cols[2]!,
        alleleA: +cols[3]!,
        alleleB: +cols[4]!,
        identity: +cols[5]!,
        cs: cols[6] ?? '',
        genomesA,
        genomesB,
      })
    },
  })

  if (bubbles.length === 0) {
    return
  }

  bubbles.sort((a, b) => a.start - b.start || a.end - b.end)

  const reverseNameMap = new Map<string, string>()
  for (const [orig, mapped] of Object.entries(assemblyNameMap)) {
    reverseNameMap.set(mapped, orig)
  }

  const { assemblyName } = query
  const refOrigName = reverseNameMap.get(assemblyName) ?? assemblyName
  const refGenomeIdx =
    genomeIdx.get(refOrigName) ?? genomeIdx.get(assemblyName)

  for (const [genomeName, features] of genomeRows) {
    const origName = reverseNameMap.get(genomeName) ?? genomeName
    const gIdx = genomeIdx.get(origName) ?? genomeIdx.get(genomeName)
    if (gIdx === undefined) {
      continue
    }

    for (const feat of features) {
      // Binary-search the first bubble whose end > feat.start; bubbles before
      // that are entirely upstream of the feature.
      let lo = 0
      let hi = bubbles.length
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (bubbles[mid]!.end <= feat.start) {
          lo = mid + 1
        } else {
          hi = mid
        }
      }

      if (lo >= bubbles.length || bubbles[lo]!.start >= feat.end) {
        continue
      }

      const result = buildCsFromCigarAndBubbles(
        feat,
        bubbles,
        lo,
        gIdx,
        refGenomeIdx,
      )
      feat.cs = result.cs
      if (result.identityTotalBp > 0) {
        feat.identity = result.identityMatchBp / result.identityTotalBp
      }
    }
  }
}
