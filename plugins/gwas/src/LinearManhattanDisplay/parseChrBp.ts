import { getSession, toLocale } from '@jbrowse/core/util'
import { parseChrBp } from '@jbrowse/ld-core'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/** A `chr:bp` locus as a menu row prints it, its position with thousands commas. */
export function chrBpLabel({ refName, bp }: { refName: string; bp: number }) {
  return `${refName}:${toLocale(bp)}`
}

/** A `chr:bp` index SNP as a menu row prints it, or as given where it names no locus. */
export function indexSnpLabel(indexSnp: string) {
  const locus = parseChrBp(indexSnp)
  return locus ? chrBpLabel(locus) : indexSnp
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
