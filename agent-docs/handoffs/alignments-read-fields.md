---
name: alignments-read-fields
description: What is left of the 2026-10-11 read-field convergence in the alignments plugin (ADR-226): the long-read cost lever in `@gmod/bam`. Read before touching the category bits.
---

# Alignments read fields: what is left

ADR-226 records what landed. Open:

1. **The long-read cost.** The category bits read every CIGAR op of a long
   read (`benches/categoryBits.bench.ts`); `@gmod/bam`'s `_computeLengthOnRef`
   already does, for `end`, and could return the two bits on the same pass.
