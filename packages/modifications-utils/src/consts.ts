// Regex for MM:Z tag format based on SAM/BAM spec (hts-specs):
// Spec: ([ACGTUN][-+]([a-z]+|[0-9]+)[.?]?(,[0-9]+)*;)*
//
// Our implementation diverges intentionally from the spec:
// 1. Capture strand as group 2: ([-+]) instead of [-+]
//    - Needed to extract strand info for downstream processing
// 2. Accept uppercase single letters: ([a-z]+|[A-Z]|[0-9]+) instead of ([a-z]+|[0-9]+)
//    - Spec only allows lowercase or digits, NOT uppercase letters
//    - Real-world BAMs contain uppercase codes (e.g., C+A, A+G)
//    - These appear to be undocumented extensions for ambiguity or variant codes
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
export const modificationRegex = new RegExp(
  /([ACGTUN])([-+])([a-z]+|[A-Z]|[0-9]+)([.?]?)/,
)

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
    mod: matches[4] || '.',
  }
}
