import type { BlockSideLanes } from './blockSideLanes.ts'

/**
 * Which of a view's packed links hold one side on an assembly, resolved once
 * per assembly: the one thing a view answers for itself, from its assembly
 * lanes or its axes.
 */
export type OnAssembly = (assemblyName: string) => (i: number) => boolean

export interface SharedGene {
  assemblyName: string
  name?: string
}

export interface LinkSides {
  lanes: BlockSideLanes
  query: OnAssembly
  mate: OnAssembly
}

// The distinct genes the links pair one gene with, in genome order (contig,
// then start in its own bp, however a view lays the contig out), read from
// both sides, since a link may hold the gene on either one; a self-comparison
// pools both, as the adapter's `partnerCounts` does
function partnersOf(
  { lanes, query, mate }: LinkSides,
  assemblyName: string,
  name: string,
) {
  const {
    nameDict,
    nameIds,
    refNameDict,
    refNameIds,
    starts,
    mateNameDict,
    mateNameIds,
    mateRefNameDict,
    mateRefNameIds,
    mateStarts,
  } = lanes
  const queryId = nameDict.indexOf(name)
  const mateId = mateNameDict.indexOf(name)
  const onQuery = query(assemblyName)
  const onMate = mate(assemblyName)
  const partners = new Map<string, { refName: string; start: number }>()
  for (let i = 0; i < nameIds.length; i++) {
    if (nameIds[i] === queryId && onQuery(i)) {
      partners.set(mateNameDict[mateNameIds[i]!]!, {
        refName: mateRefNameDict[mateRefNameIds[i]!]!,
        start: mateStarts[i]!,
      })
    }
    if (mateNameIds[i] === mateId && onMate(i)) {
      partners.set(nameDict[nameIds[i]!]!, {
        refName: refNameDict[refNameIds[i]!]!,
        start: starts[i]!,
      })
    }
  }
  return [...partners]
    .sort(
      ([, a], [, b]) =>
        a.refName.localeCompare(b.refName, undefined, { numeric: true }) ||
        a.start - b.start,
    )
    .map(([partner]) => partner)
}

/**
 * The genes sharing a block's ortholog, for `syntenyBlockLines`' `sharedBy`:
 * the partners the loaded links hold for whichever of the block's two genes
 * has more, the side its syntenic depth was counted on. An unnamed gene (a
 * PAF's `UNNAMED`) has none.
 */
export function genesSharing(
  links: LinkSides,
  genes: readonly [SharedGene, SharedGene],
) {
  const partners = ({ assemblyName, name }: SharedGene) =>
    name ? partnersOf(links, assemblyName, name) : []
  const ofQuery = partners(genes[0])
  const ofMate = partners(genes[1])
  return ofMate.length > ofQuery.length ? ofMate : ofQuery
}
