// The reference-sequence track snapshot "linear read vs ref" puts on its
// panels.
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
