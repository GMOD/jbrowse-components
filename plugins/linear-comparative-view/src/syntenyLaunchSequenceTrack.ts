// The reference-sequence track snapshot every synteny launch in this plugin
// puts on its panels — "linear read vs ref" and "reconstruct derivative
// allele". It was two byte-identical copies in the two directories, which is
// the shape a shared launcher detail takes right before the copies drift.
//
// `assemblyNames` is passed for a panel drawn against the real reference and
// omitted for one drawn against a synthetic assembly, where the track config
// already names the only assembly there is.
export function buildSequenceTrack(
  rand: () => number,
  assemblyNames: string[] | undefined,
  trackId: string,
) {
  return {
    id: `${rand()}`,
    type: 'ReferenceSequenceTrack',
    ...(assemblyNames ? { assemblyNames } : {}),
    configuration: trackId,
    displays: [
      {
        id: `${rand()}`,
        type: 'LinearReferenceSequenceDisplay',
        height: 35,
        // Inline config (not just a displayId string) so showReverse/
        // showTranslation actually override the config-schema defaults —
        // a bare id here resolves to the track's auto-injected stub display
        // config, which ignores sibling snapshot fields.
        configuration: {
          type: 'LinearReferenceSequenceDisplay',
          displayId: `${trackId}-LinearReferenceSequenceDisplay`,
          showReverse: false,
          showTranslation: false,
        },
      },
    ],
  }
}
