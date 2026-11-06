import type { BlockNameLanes } from './blockNameLanes.ts'

/**
 * How a view reads one side of its packed links beyond the name lanes: where
 * link `i` sits along its contig, for listing partners in genome order, and
 * which links hold this side on an assembly, resolved once per assembly.
 */
export interface LinkSideReaders {
  position: (i: number) => number
  onAssembly: (assemblyName: string) => (i: number) => boolean
}

export interface SharedGene {
  assemblyName: string
  name?: string
}

interface GeneLinks {
  lanes: BlockNameLanes
  query: LinkSideReaders
  mate: LinkSideReaders
}

// The distinct genes the links pair one gene with, in genome order, read from
// both sides, since a link may hold the gene on either one; a self-comparison
// pools both, as the adapter's `partnerCounts` does
function partnersOf(
  { lanes, query, mate }: GeneLinks,
  assemblyName: string,
  name: string,
) {
  const {
    nameDict,
    nameIds,
    refNameDict,
    refNameIds,
    mateNameDict,
    mateNameIds,
    mateRefNameDict,
    mateRefNameIds,
  } = lanes
  const queryId = nameDict.indexOf(name)
  const mateId = mateNameDict.indexOf(name)
  const onQuery = query.onAssembly(assemblyName)
  const onMate = mate.onAssembly(assemblyName)
  const partners = new Map<string, { refName: string; position: number }>()
  for (let i = 0; i < nameIds.length; i++) {
    if (nameIds[i] === queryId && onQuery(i)) {
      partners.set(mateNameDict[mateNameIds[i]!]!, {
        refName: mateRefNameDict[mateRefNameIds[i]!]!,
        position: mate.position(i),
      })
    }
    if (mateNameIds[i] === mateId && onMate(i)) {
      partners.set(nameDict[nameIds[i]!]!, {
        refName: refNameDict[refNameIds[i]!]!,
        position: query.position(i),
      })
    }
  }
  return [...partners]
    .sort(
      ([, a], [, b]) =>
        a.refName.localeCompare(b.refName, undefined, { numeric: true }) ||
        a.position - b.position,
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
  links: GeneLinks,
  genes: readonly [SharedGene, SharedGene],
) {
  const partners = ({ assemblyName, name }: SharedGene) =>
    name ? partnersOf(links, assemblyName, name) : []
  const ofQuery = partners(genes[0])
  const ofMate = partners(genes[1])
  return ofMate.length > ofQuery.length ? ofMate : ofQuery
}
