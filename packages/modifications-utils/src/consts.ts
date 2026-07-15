// Regex for MM:Z tag format based on SAM/BAM spec (hts-specs):
// Spec: ([ACGTUN][-+]([a-z]+|[0-9]+)[.?]?(,[0-9]+)*;)*
//
// Our implementation diverges intentionally from the spec:
// 1. Capture strand as group 2: ([-+]) instead of [-+]
//    - Needed to extract strand info for downstream processing
// 2. Accept uppercase single letters: ([a-z]+|[A-Z]|[0-9]+) instead of ([a-z]+|[0-9]+)
//    - The spec PROSE defines uppercase ambiguity codes A/C/G/T/U and N (an
//      unspecified modification of the respective canonical base), but the
//      spec's own grammar regex omits them — a known inconsistency in the spec.
//    - Ambiguity codes are always a single uppercase letter (never multi-char
//      or mixed with lowercase), hence [A-Z] rather than [A-Z]+.
// 3. Capture modifier flag as group 4: ([.?]?) instead of non-capturing
//    - Per spec: '?' = modification status of skipped bases is unknown
//    - Per spec: '.' or absent = skipped bases should be assumed low probability of modification
//    - We capture this to support correct interpretation of skipped positions
// 4. Don't match delta values or semicolon
//    - We extract just the base modification header (e.g., "C+m?" from "C+m?,2,1;")
//    - Caller splits by ";" and "," to get this header before passing to regex
//
// Real-world examples with modifier flags:
//   C+m   → skipped bases = low probability modification (default)
//   C+m.  → skipped bases = low probability modification (explicit)
//   C+m?  → skipped bases = unknown modification status
export const modificationRegex = /([ACGTUN])([-+])([a-z]+|[A-Z]|[0-9]+)([.?]?)/

/**
 * #api
 * Parses one MM-tag modification header (e.g. `C+m`) into its base, strand,
 * type string, and modification code.
 */
export function parseModHeader(
  basemod: string,
  fullmod: string,
): { base: string; strand: string; typestr: string; mod: string } {
  const matches = modificationRegex.exec(basemod)
  if (!matches) {
    throw new Error(`bad format for MM tag: "${fullmod}"`)
  }
  return {
    base: matches[1]!,
    strand: matches[2]!,
    typestr: matches[3]!,
    mod: matches[4]! !== '' ? matches[4]! : '.',
  }
}
