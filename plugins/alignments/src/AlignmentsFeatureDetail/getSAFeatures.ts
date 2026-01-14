import { getSession } from '@jbrowse/core/util'

import {
  featurizeSA,
  getClip,
  getLengthSansClipping,
} from '../MismatchParser/index.ts'

import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface ReducedFeature {
  refName: string
  start: number
  clipLengthAtStartOfRead: number
  end: number
  strand: number
  seqLength: number
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
  feature: Feature
}) {
  const { assemblyManager } = getSession(view)
  const cigar = feature.get('CIGAR') as string
  const origStrand = feature.get('strand') as number
  const SA = (feature.get('tags')?.SA as string) || ''
  const readName = feature.get('name') as string
  const clipLengthAtStartOfRead = getClip(cigar, 1)

  // get the canonical refname for the read because if the read.get('refName')
  // is chr1 and the actual fasta refName is 1 then no tracks can be opened on
  // the top panel of the linear read vs ref
  const assembly = await assemblyManager.waitForAssembly(view.assemblyNames[0]!)
  if (!assembly) {
    throw new Error('assembly not found')
  }

  const suppAlns = featurizeSA(SA, feature.id(), origStrand, readName, true)

  const feat = {
    ...feature.toJSON(),
    clipLengthAtStartOfRead,
    strand: 1,
    mate: {
      refName: readName,
      start: clipLengthAtStartOfRead,
      end: clipLengthAtStartOfRead + getLengthSansClipping(cigar),
    },
  }
  const features = [feat, ...suppAlns] as ReducedFeature[]

  for (const [i, feature_] of features.entries()) {
    const f = feature_
    f.refName = assembly.getCanonicalRefName2(f.refName)
    f.syntenyId = i
    f.mate.syntenyId = i
    f.mate.uniqueId = `${f.uniqueId}_mate`
  }
  return features.toSorted(
    (a, b) => a.clipLengthAtStartOfRead - b.clipLengthAtStartOfRead,
  )
}
