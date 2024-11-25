import { getSession } from '@jbrowse/core/util'

// locals
import { featurizeSA, getClip, getLengthSansClipping } from '../MismatchParser'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface ReducedFeature {
  refName: string
  start: number
  clipPos: number
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
  const clipPos = getClip(cigar, 1)

  // get the canonical refname for the read because if the read.get('refName')
  // is chr1 and the actual fasta refName is 1 then no tracks can be opened on
  // the top panel of the linear read vs ref
  const assembly = await assemblyManager.waitForAssembly(view.assemblyNames[0]!)
  if (!assembly) {
    throw new Error('assembly not found')
  }

  const suppAlns = featurizeSA(SA, feature.id(), origStrand, readName, true)

  const feat = feature.toJSON()
  feat.clipPos = clipPos
  feat.strand = 1

  feat.mate = {
    refName: readName,
    start: clipPos,
    end: clipPos + getLengthSansClipping(cigar),
  }
  const features = [feat, ...suppAlns] as ReducedFeature[]

  features.forEach((f, idx) => {
    f.refName = assembly.getCanonicalRefName(f.refName) || f.refName
    f.syntenyId = idx
    f.mate.syntenyId = idx
    f.mate.uniqueId = `${f.uniqueId}_mate`
  })
  features.sort((a, b) => a.clipPos - b.clipPos)
  return features
}
