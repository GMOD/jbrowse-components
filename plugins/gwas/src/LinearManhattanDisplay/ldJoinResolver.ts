import { canonicalizeViewRefName, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { parseChrBp } from './parseChrBp.ts'

import type { LdJoin } from '../GWASAdapter/ldJoin.ts'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface LdJoinHost extends IStateTreeNode {
  ldColoringActive: boolean
  ldAdapterConfig: Record<string, unknown> | undefined
}

/**
 * The LD join each region's fetch asks the adapter for, resolved on the main
 * thread, where the aliases are: whether a placed index sits on the region's
 * contig, and that contig as the LD file spells it. Undefined outside LD
 * coloring, because resolving the LD file's names reads its refNames, which
 * for the in-memory PLINK adapter parses the whole `.ld` file.
 */
export function ldJoinResolver(self: LdJoinHost, indexSnp: string | undefined) {
  const { ldAdapterConfig } = self
  if (!self.ldColoringActive || !indexSnp || !ldAdapterConfig) {
    return undefined
  }
  const locus = parseChrBp(indexSnp)
  const placed = locus && {
    refName: canonicalizeViewRefName(self, locus.refName),
    start: locus.bp - 1,
  }
  const { assemblyManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  return async (
    region: Region,
    signal: AbortSignal,
  ): Promise<LdJoin | undefined> => {
    if (placed && placed.refName !== region.refName) {
      return undefined
    }
    const names = await assemblyManager.getRefNameMapForAdapter(
      ldAdapterConfig,
      region.assemblyName,
      { sessionId, signal },
    )
    return {
      index: placed ? { start: placed.start } : { name: indexSnp },
      refName: names[region.refName] ?? region.refName,
    }
  }
}
