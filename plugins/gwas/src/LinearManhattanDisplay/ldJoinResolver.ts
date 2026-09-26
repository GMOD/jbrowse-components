import { canonicalizeViewRefName, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { parseChrBp } from './parseChrBp.ts'

import type { LdJoin } from '../GWASAdapter/ldJoin.ts'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The LD join one region's fetch asks the adapter for, resolved on the main
 * thread, where the aliases are: whether a placed index sits on the region's
 * contig, and that contig as the LD file spells it. Resolving the LD file's
 * names reads its refNames, which for the in-memory PLINK adapter parses the
 * whole `.ld` file, so only a plot that reads the join calls this.
 */
export async function ldJoinFor(
  self: IStateTreeNode,
  ldAdapterConfig: Record<string, unknown>,
  indexSnp: string,
  region: Region,
  signal: AbortSignal,
): Promise<LdJoin | undefined> {
  const locus = parseChrBp(indexSnp)
  const placed = locus && {
    refName: canonicalizeViewRefName(self, locus.refName),
    start: locus.bp - 1,
  }
  if (placed && placed.refName !== region.refName) {
    return undefined
  }
  const names = await getSession(self).assemblyManager.getRefNameMapForAdapter(
    ldAdapterConfig,
    region.assemblyName,
    { sessionId: getRpcSessionId(self), signal },
  )
  return {
    index: placed ? { start: placed.start } : { name: indexSnp },
    refName: names[region.refName] ?? region.refName,
  }
}
