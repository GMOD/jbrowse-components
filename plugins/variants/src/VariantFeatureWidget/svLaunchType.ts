// SO-term substrings that mark a variant as structural enough to warrant the SV
// launch panel. Matched as substrings of the feature's `type` (e.g.
// 'copy_number' catches 'copy_number_variation', 'duplication' catches
// 'tandem_duplication'). Breakend/translocation/paired variants are handled by
// their own branches before this check.
const svTypes = ['inversion', 'deletion', 'duplication', 'copy_number', 'sv']

export function isSvLaunchType(type: string) {
  return svTypes.some(t => type.includes(t))
}
