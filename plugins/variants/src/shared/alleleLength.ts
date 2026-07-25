import type { Feature } from '@jbrowse/core/util'

// Longest allele a record describes, in bp: the reference span, or an ALT
// sequence longer than it. `end - start` alone answers "how much reference does
// this consume", which is 1 for every insertion however large — so a length
// filter written on the span silently keeps SNPs and drops the insertions,
// exactly the half of a pangenome callset an SV view is about. Symbolic ALTs
// (`<INS>` and friends) carry no sequence to measure and are already resolved
// into the feature's span by `getEnd`, so they fall through to it.
export function getAlleleLength(feature: Feature) {
  const span = feature.get('end') - feature.get('start')
  const alt = feature.get('ALT') as string[] | undefined
  let longest = span
  for (const a of alt ?? []) {
    if (!a.startsWith('<') && a.length > longest) {
      longest = a.length
    }
  }
  return longest
}
