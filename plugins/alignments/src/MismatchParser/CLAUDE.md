# MismatchParser

## X-CIGAR + MD coexistence

`getMismatches` calls `cigarToMismatches2` (which emits mismatches at `X` ops)
then `mdToMismatches2` (which emits mismatches per MD letter). Standard BAMs
use *either* `X`/`=` CIGAR ops *or* `M` + MD tag — not both — so in practice
the two passes don't double-emit. If you encounter a BAM that emits both,
mismatches will duplicate. Don't "fix" this prophylactically; the convention
is the contract.

## Two parallel mismatch paths

There are two independent walkers:

- `cigarToMismatches2` + `mdToMismatches2` → consumed via the `mismatches`
  array (`BamSlightlyLazyFeature.get('mismatches')`).
- `forEachMismatchNumeric` → consumed via `feature.forEachMismatch(callback)`,
  the preferred zero-allocation path. Performance profiling showed
  `forEachMismatch` is faster than building the array, so new code should
  prefer it.

Their `CIGAR_X` handling differs: `forEachMismatchNumeric` consults MD for
`altbase` on X ops, `cigarToMismatches2` does not. Keep this in mind if you
find rendering inconsistencies between paths.
