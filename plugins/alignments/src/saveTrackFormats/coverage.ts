import { computeCoverage } from '@jbrowse/alignments-core'

import type { CoverageGap } from '@jbrowse/alignments-core'
import type { AssemblyHost, Feature, Region } from '@jbrowse/core/util'

// The stretches of the reference a read spans without covering: a deletion and
// a skipped intron, which the coverage band carves out of its depth too
function gapsOf(read: Feature): CoverageGap[] {
  const cigar = (read.get('CIGAR') as string | undefined) ?? ''
  const gaps: CoverageGap[] = []
  let pos = read.get('start')
  for (const [, len, op] of cigar.matchAll(/(\d+)([MIDNSHP=X])/g)) {
    const length = +len!
    if (op === 'D' || op === 'N') {
      gaps.push({
        start: pos,
        end: pos + length,
        type: op === 'D' ? 'deletion' : 'skip',
        strand: 0,
        featureStrand: 0,
      })
    }
    if (op === 'M' || op === '=' || op === 'X' || op === 'D' || op === 'N') {
      pos += length
    }
  }
  return gaps
}

/**
 * The depth at every base of each exported region, run-length encoded as
 * bedGraph rows, over the reads the track shows and by the coverage band's
 * rule. Bases no read covers are left out, as `bedtools genomecov -bg` does.
 * Rows name the assembly's sequence, as the SAM export's records do.
 */
export function stringifyCoverageBedGraph({
  features,
  regions,
  session,
  assemblyName,
}: {
  features: Feature[]
  regions: Region[]
  session: AssemblyHost
  assemblyName: string
}) {
  const assembly = session.assemblyManager.get(assemblyName)
  const canonical = (refName: string) =>
    assembly?.getCanonicalRefName2(refName) ?? refName
  const rows: string[] = []
  for (const region of regions) {
    const reads = features.filter(
      f => canonical(f.get('refName')) === region.refName,
    )
    const { depths, startPos } = computeCoverage(
      reads.map(f => ({ start: f.get('start'), end: f.get('end') })),
      reads.flatMap(f => gapsOf(f)),
      region.start,
      region.end,
    )
    const n = Math.min(depths.length, region.end - startPos)
    let i = 0
    while (i < n) {
      const depth = depths[i]!
      let j = i + 1
      while (j < n && depths[j] === depth) {
        j++
      }
      if (depth > 0) {
        rows.push(
          `${region.refName}\t${startPos + i}\t${startPos + j}\t${depth}`,
        )
      }
      i = j
    }
  }
  return rows.join('\n')
}
