---
name: alignments-read-fields
description: What is left of the 2026-10-11 read-field convergence in the alignments plugin (ADR-226). Colin's call on whether `pairing` replaces the `properPairs` filter, and the long-read cost lever in `@gmod/bam`. Read before touching the read filter or the category bits.
---

# Alignments read fields: what is left

ADR-226 records what landed. Open, in order:

1. **Colin's call: does `pairing` replace the `properPairs` filter?** The
   facet has `pairing` (`shared/pairing.ts`). As a filter it would judge a
   chain by its representative read (`chainRepresentative`), where
   `properPairs` asks "is every read concordant" (`isProperPairChain` in
   `filterChainFeatures.ts`), and a supplementary is never concordant. So
   `properPairs: 'exclude'` keeps a concordant pair whose mate is split at a
   breakpoint, and "hide concordant" would drop it with no way back, since
   the categories AND. Options: keep `properPairs` as the filter's word for
   the chain question, or give `pairing`'s chain key a fifth level for such a
   chain.
2. **The long-read cost.** The category bits read every CIGAR op of a long
   read (`benches/categoryBits.bench.ts`); `@gmod/bam`'s `_computeLengthOnRef`
   already does, for `end`, and could return the two bits on the same pass.
