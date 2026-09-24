/**
 * One lane a multi-genome source declares: the assembly name its features'
 * mates carry, and optionally the source's own label for it and a heading
 * that gathers lanes belonging together (a diploid sample's two haplotypes,
 * a clade).
 */
export interface DeclaredLane {
  name: string
  label?: string
  group?: string
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

/** the well-formed lanes of a list, each read only for the keys it types */
export function declaredLanes(value: unknown): DeclaredLane[] {
  const out: DeclaredLane[] = []
  for (const lane of Array.isArray(value) ? (value as unknown[]) : []) {
    if (
      typeof lane === 'object' &&
      lane !== null &&
      'name' in lane &&
      typeof lane.name === 'string'
    ) {
      out.push({
        name: lane.name,
        label: 'label' in lane ? optionalString(lane.label) : undefined,
        group: 'group' in lane ? optionalString(lane.group) : undefined,
      })
    }
  }
  return out
}

/**
 * The lanes a `CoreGetInfo` header declares under `lanes`; none for a header
 * that declares none. A source that knows its lane universe up front, the way
 * a pangenome graph names every haplotype it holds, lets a lane picker offer
 * the whole of it before a fetch has placed any lane.
 */
export function declaredLanesOf(header: unknown) {
  return declaredLanes(
    typeof header === 'object' && header !== null && 'lanes' in header
      ? header.lanes
      : undefined,
  )
}
