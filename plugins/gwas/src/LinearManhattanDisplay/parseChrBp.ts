import { getSession } from '@jbrowse/core/util'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * A `chr:bp` index SNP's contig and 1-based position, split on the last colon
 * so a refName may hold one. The position may carry the thousands commas the
 * right-click label shows. A bare id, a tail that is no integer, or position
 * 0 places nothing.
 */
export function parseChrBp(
  indexSnp: string,
): { refName: string; bp: number } | undefined {
  const colon = indexSnp.lastIndexOf(':')
  const posStr = colon > 0 ? indexSnp.slice(colon + 1).replaceAll(',', '') : ''
  const bp = Number(posStr)
  return /^\d+$/.test(posStr) && bp >= 1
    ? { refName: indexSnp.slice(0, colon), bp }
    : undefined
}

/**
 * The index SNP's canonical contig on an assembly and its 0-based start, or
 * undefined where it names no `chr:bp`. A session may spell the contig by an
 * alias.
 */
export function placeIndexSnp(
  node: IAnyStateTreeNode,
  indexSnp: string,
  assemblyName: string,
) {
  const locus = parseChrBp(indexSnp)
  return locus
    ? {
        refName:
          getSession(node)
            .assemblyManager.get(assemblyName)
            ?.getCanonicalRefName2(locus.refName) ?? locus.refName,
        start: locus.bp - 1,
      }
    : undefined
}
