// The one-contig temporary assembly a launcher registers via
// `addTemporaryAssembly`, so that a synthetic sequence can be drawn against the
// reference as if it were a genome. Three launchers mint one: "linear read vs
// ref" and "dotplot of read vs ref", whose contig is a single read, and
// "reconstruct derivative allele", whose contig is a path several reads agree
// on. Kept as one builder so they cannot drift apart — a drift here previously
// hung DotplotReadVsRef on an unregistered assemblyName.
//
// The return type is annotated inline (an anonymous object type, not a named
// interface) so it keeps an implicit index signature and stays assignable to
// session.addTemporaryAssembly's `Record<string, unknown>` arg.
export function buildSyntheticAssembly({
  refName,
  assemblyName,
  displayName,
  totalLength,
  seq,
  sequenceTrackName,
  trackId,
  uniqueId,
}: {
  // The single contig's name, inside the assembly: a read name, or the
  // derivative allele's own name.
  refName: string
  assemblyName: string
  // stamp-free label for the panel header; see buildReadVsRefNames
  displayName: string
  totalLength: number
  // Absent or empty is a supported case, not a failure: a hard-clipped read
  // carries no bases for its clipped part, and a reconstructed allele is a
  // structure with no consensus at all. The sequence track then renders as
  // unavailable rather than as wrong bases.
  seq: string | undefined
  sequenceTrackName: string
  trackId: string
  uniqueId: string
}): {
  name: string
  displayName: string
  sequence: {
    type: 'ReferenceSequenceTrack'
    name: string
    trackId: string
    assemblyNames: string[]
    adapter: {
      type: 'FromConfigSequenceAdapter'
      noAssemblyManager: true
      features: {
        start: number
        end: number
        seq: string
        refName: string
        uniqueId: string
      }[]
    }
  }
} {
  return {
    name: assemblyName,
    displayName,
    sequence: {
      type: 'ReferenceSequenceTrack',
      name: sequenceTrackName,
      trackId,
      assemblyNames: [assemblyName],
      adapter: {
        type: 'FromConfigSequenceAdapter',
        noAssemblyManager: true,
        // The region's length comes from this feature's own start/end
        // (`mergeFeaturesToRegions`), never from `seq.length`, which is what
        // makes the empty-sequence case above a full-length axis rather than a
        // zero-width one.
        features: [
          {
            start: 0,
            end: totalLength,
            seq: seq ?? '',
            refName,
            uniqueId,
          },
        ],
      },
    },
  }
}

export type SyntheticAssembly = ReturnType<typeof buildSyntheticAssembly>
