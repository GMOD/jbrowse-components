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
// 3. Non-capturing modifier group: (?:[.?]?) instead of [.?]?
//    - The . and ? flags are metadata for other parsers; we don't need them
//    - Non-capturing clarifies which groups we use (1,2,3)
// 4. Don't match delta values or semicolon
//    - We extract just the base modification header (e.g., "C+m" from "C+m,2,1;")
//    - Caller splits by ";" and "," to get this header before passing to regex
//
// Real-world examples with ? and . modifiers:
//   C+m?  → uncertain methylation status
//   C+m.  → skip-this-base marker
export const modificationRegex = new RegExp(
  /([ACGTUN])([-+])([a-z]+|[A-Z]|[0-9]+)(?:[.?]?)/,
)

export function parseModHeader(
  basemod: string,
  fullmod: string,
): { base: string; strand: string; typestr: string } {
  const matches = modificationRegex.exec(basemod)
  if (!matches) {
    throw new Error(`bad format for MM tag: "${fullmod}"`)
  }
  return {
    base: matches[1]!,
    strand: matches[2]!,
    typestr: matches[3]!,
  }
}
