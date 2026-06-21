import {
  featurizeSA,
  getClip,
  getLengthSansClipping,
} from '@jbrowse/cigar-utils'
import { getSession } from '@jbrowse/core/util'

import { getTag } from './util.ts'

import type { AlignmentFeatureSerialized } from './util.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface ReducedFeature {
  refName: string
  start: number
  clipLengthAtStartOfRead: number
  end: number
  strand: number
  seqLength?: number
  syntenyId?: number
  uniqueId: string
  mate: {
    refName: string
    start: number
    end: number
    syntenyId?: number
    uniqueId?: string
  }
}

export async function getSAFeatures({
  view,
  feature,
}: {
  view: LinearGenomeViewModel
  feature: AlignmentFeatureSerialized
}) {
  const { assemblyManager } = getSession(view)
  const { CIGAR: cigar, strand: origStrand = 1, name: readName } = feature
  if (cigar === undefined) {
    throw new Error('feature missing CIGAR')
  }
  if (readName === undefined) {
    throw new Error('feature missing name')
  }
  const sa = getTag('SA', feature)
  const SA = typeof sa === 'string' ? sa : ''
  const clipLengthAtStartOfRead = getClip(cigar, 1)

  // get the canonical refname for the read because if the read.get('refName')
  // is chr1 and the actual fasta refName is 1 then no tracks can be opened on
  // the top panel of the linear read vs ref
  const assembly = await assemblyManager.waitForAssembly(view.assemblyNames[0]!)
  if (!assembly) {
    throw new Error('assembly not found')
  }

  const suppAlns = featurizeSA(SA, feature.uniqueId, origStrand, readName, true)

  const feat = {
    ...feature,
    clipLengthAtStartOfRead,
    strand: 1,
    mate: {
      refName: readName,
      start: clipLengthAtStartOfRead,
      end: clipLengthAtStartOfRead + getLengthSansClipping(cigar),
    },
  }
  return ([feat, ...suppAlns] as ReducedFeature[])
    .map((f, i) => ({
      ...f,
      refName: assembly.getCanonicalRefName2(f.refName),
      syntenyId: i,
      mate: { ...f.mate, syntenyId: i, uniqueId: `${f.uniqueId}_mate` },
    }))
    .toSorted((a, b) => a.clipLengthAtStartOfRead - b.clipLengthAtStartOfRead)
}
