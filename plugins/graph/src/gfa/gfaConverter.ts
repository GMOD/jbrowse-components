import type { Graph, GraphEdge, GraphNode, GraphPath } from '../types.ts'
import type { GFAGraph } from './gfaParser.ts'

function parseCigarOverlap(cigar: string) {
  if (!cigar || cigar === '*') {
    return 0
  }

  const matches = cigar.match(/(\d+)M/g)
  if (!matches) {
    return 0
  }

  return matches.reduce((sum, match) => {
    const num = parseInt(match.slice(0, -1))
    return sum + num
  }, 0)
}

export function convertGFAToGraph(gfaGraph: GFAGraph, name = 'Imported GFA') {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  // Collect all strand-specific node IDs referenced by links and paths
  const usedStrands = new Set<string>()
  for (const link of gfaGraph.links) {
    const sourceStrand = link.strand1 || '+'
    const targetStrand = link.strand2 || '+'
    usedStrands.add(`${link.source}${sourceStrand}`)
    usedStrands.add(`${link.target}${targetStrand}`)
  }

  for (const gfaPath of gfaGraph.paths) {
    for (const segment of gfaPath.path.split(',')) {
      const strand = segment.slice(-1)
      const nodeName = segment.slice(0, -1)
      usedStrands.add(`${nodeName}${strand}`)
    }
  }

  for (const walk of gfaGraph.walks) {
    for (const seg of walk.segments) {
      usedStrands.add(`${seg.id}${seg.strand}`)
    }
  }

  // If no links or paths, create forward-strand nodes for all segments
  const hasReferences = usedStrands.size > 0

  for (const gfaNode of gfaGraph.nodes) {
    const dp = gfaNode.tags.dp ?? gfaNode.tags.RC ?? gfaNode.tags.FC ?? gfaNode.tags.KC
    const depth = typeof dp === 'number' ? dp || 1 : 1

    if (!hasReferences || usedStrands.has(`${gfaNode.id}+`)) {
      nodes.push({
        id: `${gfaNode.id}+`,
        name: gfaNode.id,
        length: gfaNode.length,
        depth,
      })
    }

    if (usedStrands.has(`${gfaNode.id}-`)) {
      nodes.push({
        id: `${gfaNode.id}-`,
        name: gfaNode.id,
        length: gfaNode.length,
        depth,
      })
    }
  }

  for (const link of gfaGraph.links) {
    const overlap = parseCigarOverlap(link.cigar)
    const sourceStrand = link.strand1 || '+'
    const targetStrand = link.strand2 || '+'
    const from = `${link.source}${sourceStrand}`
    const to = `${link.target}${targetStrand}`

    edges.push({ from, to, overlap })
  }

  const paths: GraphPath[] = []
  const edgeToPathsMap = new Map<string, Set<string>>()

  for (const gfaPath of gfaGraph.paths) {
    const pathSegments = gfaPath.path.split(',')
    const nodeIds: string[] = []

    for (const segment of pathSegments) {
      const strand = segment.slice(-1)
      const nodeName = segment.slice(0, -1)
      nodeIds.push(`${nodeName}${strand}`)
    }

    paths.push({ name: gfaPath.name, nodeIds } satisfies GraphPath)

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const from = nodeIds[i]!
      const to = nodeIds[i + 1]!
      const edgeKey = `${from}->${to}`

      if (!edgeToPathsMap.has(edgeKey)) {
        edgeToPathsMap.set(edgeKey, new Set())
      }
      edgeToPathsMap.get(edgeKey)!.add(gfaPath.name)
    }
  }

  for (const walk of gfaGraph.walks) {
    const nodeIds: string[] = []
    for (const seg of walk.segments) {
      nodeIds.push(`${seg.id}${seg.strand}`)
    }
    const name = `${walk.sample}#${walk.haplotype}`
    paths.push({
      name,
      nodeIds,
      sample: walk.sample,
      haplotype: walk.haplotype,
      contig: walk.contig,
    } satisfies GraphPath)

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
