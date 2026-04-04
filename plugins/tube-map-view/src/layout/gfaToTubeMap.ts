// Converts parsed GFA data into tube map layout input

import { computeTubeMapLayout } from './tubeMapLayout.ts'

import type { TubeMapLayout } from './types.ts'

interface GFANode {
  id: string
  length: number
  sequence: string
  tags: Record<string, string | number>
}

interface GFAPath {
  name: string
  path: string
  rest: string[]
}

interface GFAWalkSegment {
  id: string
  strand: string
}

interface GFAWalk {
  sample: string
  haplotype: number
  contig: string
  start: number
  end: number
  segments: GFAWalkSegment[]
  tags: Record<string, string | number>
}

interface GFAGraph {
  nodes: GFANode[]
  links: unknown[]
  paths: GFAPath[]
  walks: GFAWalk[]
  header: Record<string, string | number>[]
  id: string
}

export function layoutGFA(gfa: GFAGraph, widthPerBp = 10): TubeMapLayout {
  const inputNodes = gfa.nodes.map(n => ({
    name: n.id,
    sequenceLength: n.length,
    sequence: n.sequence === '*' ? undefined : n.sequence,
  }))

  const inputTracks = []

  // convert P (path) lines
  for (const p of gfa.paths) {
    const segmentStrs = p.path.split(',')
    const segments = segmentStrs.map(s => {
      const orient = s.at(-1)
      const name = s.slice(0, -1)
      return { name, isForward: orient === '+' }
    })
    inputTracks.push({
      id: `path:${p.name}`,
      name: p.name,
      segments,
      type: 'haplotype' as const,
      indexOfFirstBase: 0,
    })
  }

  // convert W (walk) lines
  for (const w of gfa.walks) {
    const segments = w.segments.map(s => ({
      name: s.id,
      isForward: s.strand === '+',
    }))
    const name = `${w.sample}#${w.haplotype}#${w.contig}`
    inputTracks.push({
      id: `walk:${name}`,
      name,
      segments,
      type: 'haplotype' as const,
      indexOfFirstBase: Math.max(w.start, 0),
    })
  }

  return computeTubeMapLayout(inputNodes, inputTracks, widthPerBp)
}
