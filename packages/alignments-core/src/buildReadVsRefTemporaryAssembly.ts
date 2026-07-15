// The synthetic read assembly both read-vs-ref launchers (linear synteny +
// dotplot) register via addTemporaryAssembly. Kept as one builder so the two
// stay in lockstep — a drift here previously hung DotplotReadVsRef on an
// unregistered assemblyName.
//
// The return type is annotated inline (an anonymous object type, not a named
// interface) so it keeps an implicit index signature and stays assignable to
// session.addTemporaryAssembly's `Record<string, unknown>` arg.
export function buildReadVsRefTemporaryAssembly({
  readName,
  readAssembly,
  totalLength,
  seq,
  trackId,
  uniqueId,
}: {
  readName: string
  readAssembly: string
  totalLength: number
  seq: string | undefined
  trackId: string
  uniqueId: string
}): {
  name: string
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
    name: readAssembly,
    sequence: {
      type: 'ReferenceSequenceTrack',
      name: 'Read sequence',
      trackId,
      assemblyNames: [readAssembly],
      adapter: {
        type: 'FromConfigSequenceAdapter',
        noAssemblyManager: true,
        features: [
          {
            start: 0,
            end: totalLength,
            seq: seq ?? '',
            refName: readName,
            uniqueId,
          },
        ],
      },
    },
  }
}

export type ReadVsRefTemporaryAssembly = ReturnType<
  typeof buildReadVsRefTemporaryAssembly
>
