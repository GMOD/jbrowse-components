import type { Graph, GraphEdge, GraphNode, GraphPath } from '../types.ts'
import type { GFAGraph, GFANode } from '@jbrowse/graph-core'

function parseCigarOverlap(cigar: string) {
  let sum = 0
  for (const m of cigar.matchAll(/(\d+)M/g)) {
    sum += +m[1]!
  }
  return sum
}

// Strand-specific node IDs (`<id>+` / `<id>-`) referenced by any link, path,
// or walk. Path segments are already in `<id><strand>` form.
function collectUsedStrands(gfaGraph: GFAGraph) {
  const used = new Set<string>()
  for (const link of gfaGraph.links) {
    used.add(`${link.source}${link.strand1 || '+'}`)
    used.add(`${link.target}${link.strand2 || '+'}`)
  }
  for (const gfaPath of gfaGraph.paths) {
    for (const segment of gfaPath.path.split(',')) {
      used.add(segment)
    }
  }
  for (const walk of gfaGraph.walks) {
    for (const seg of walk.segments) {
      used.add(`${seg.id}${seg.strand}`)
    }
  }
  return used
}

function makeNode(
  gfaNode: GFANode,
  strand: '+' | '-',
  depth: number,
): GraphNode {
  return {
    id: `${gfaNode.id}${strand}`,
    name: gfaNode.id,
    length: gfaNode.length,
    depth,
  }
}

export function convertGFAToGraph(gfaGraph: GFAGraph, name = 'Imported GFA') {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  const usedStrands = collectUsedStrands(gfaGraph)
  // With no links/paths/walks, fall back to forward-strand nodes for all segments
  const hasReferences = usedStrands.size > 0

  for (const gfaNode of gfaGraph.nodes) {
    const dp =
      gfaNode.tags.dp ?? gfaNode.tags.RC ?? gfaNode.tags.FC ?? gfaNode.tags.KC
    const depth = typeof dp === 'number' && dp > 0 ? dp : 1

    if (!hasReferences || usedStrands.has(`${gfaNode.id}+`)) {
      nodes.push(makeNode(gfaNode, '+', depth))
    }
    if (usedStrands.has(`${gfaNode.id}-`)) {
      nodes.push(makeNode(gfaNode, '-', depth))
    }
  }

  for (const link of gfaGraph.links) {
    edges.push({
      from: `${link.source}${link.strand1 || '+'}`,
      to: `${link.target}${link.strand2 || '+'}`,
      overlap: parseCigarOverlap(link.cigar),
    })
  }

  const paths: GraphPath[] = []
  const edgeToPathsMap = new Map<string, Set<string>>()

  function recordPathEdges(nodeIds: string[], name: string) {
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const from = nodeIds[i]!
      const to = nodeIds[i + 1]!
      const edgeKey = `${from}->${to}`
      if (!edgeToPathsMap.has(edgeKey)) {
        edgeToPathsMap.set(edgeKey, new Set())
      }
      edgeToPathsMap.get(edgeKey)!.add(name)
    }
  }

  for (const gfaPath of gfaGraph.paths) {
    // path segments are already in `<id><strand>` form
    const nodeIds = gfaPath.path.split(',')
    paths.push({ name: gfaPath.name, nodeIds } satisfies GraphPath)
    recordPathEdges(nodeIds, gfaPath.name)
  }

  for (const walk of gfaGraph.walks) {
    const nodeIds = walk.segments.map(seg => `${seg.id}${seg.strand}`)
    const name = `${walk.sample}#${walk.haplotype}`
    paths.push({
      name,
      nodeIds,
      sample: walk.sample,
      haplotype: walk.haplotype,
      contig: walk.contig,
    } satisfies GraphPath)
    recordPathEdges(nodeIds, name)
  }

  for (const edge of edges) {
    const edgeKey = `${edge.from}->${edge.to}`
    const pathIds = edgeToPathsMap.get(edgeKey)
    if (pathIds && pathIds.size > 0) {
      edge.pathIds = [...pathIds]
    }
  }

  return {
    name,
    nodes,
    edges,
    paths: paths.length > 0 ? paths : undefined,
  } satisfies Graph
}
