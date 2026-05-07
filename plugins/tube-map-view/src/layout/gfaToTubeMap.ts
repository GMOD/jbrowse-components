import { computeTubeMapLayout } from './tubeMapLayout.ts'

import type { TubeMapLayout } from './types.ts'
import type { GFAGraph } from '../gfa/gfaParser.ts'

export function layoutGFA(gfa: GFAGraph, widthPerBp = 10): TubeMapLayout {
  const inputNodes = gfa.nodes.map(n => ({
    name: n.id,
    sequenceLength: n.length,
    sequence: n.sequence === '*' ? undefined : n.sequence,
  }))

  const inputTracks = [
    ...gfa.paths.map(p => ({
      id: `path:${p.name}`,
      name: p.name,
      segments: p.path.split(',').map(s => ({
        name: s.slice(0, -1),
        isForward: s.at(-1) === '+',
      })),
      type: 'haplotype' as const,
      indexOfFirstBase: 0,
    })),
    ...gfa.walks.map(w => {
      const name = `${w.sample}#${w.haplotype}#${w.contig}`
      return {
        id: `walk:${name}`,
        name,
        segments: w.segments.map(s => ({
          name: s.id,
          isForward: s.strand === '+',
        })),
        type: 'haplotype' as const,
        indexOfFirstBase: Math.max(w.start, 0),
      }
    }),
  ]

  return computeTubeMapLayout(inputNodes, inputTracks, widthPerBp)
}
