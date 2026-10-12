---
name: category-bits-on-the-bam-end-pass
description: A long read's category bits (ADR-226) read every CIGAR op, a second full walk after `@gmod/bam`'s `_computeLengthOnRef` already read them all for `end`. Returning the two bits from that pass removes the extract's costliest per-read addition on long reads. Needs a `@gmod/bam` release.
---

# Category bits on `@gmod/bam`'s end pass

Moved from a handoff on 2026-10-11, the one item left of ADR-226.

`numericCigarCategoryBits` (`plugins/alignments/src/shared/readCategoryBits.ts`)
reads every op of a read's CIGAR, while the windowed walk stops at the region.
On `200x.longread.bam` (7,300 ops a read) the bits cost 0.37 of the walk, and a
pass that only ORs each op's bit runs about as fast, so the pass itself is the
cost. `plugins/alignments/benches/categoryBits.bench.ts` has the table.

`@gmod/bam`'s `_computeLengthOnRef` already reads every op to answer `end`.
Have it return the two bits on the same pass, and `BamSlightlyLazyFeature`
reads them instead of walking again. Re-run the bench's long-read BAM arm for
the before/after; CRAM (0.08) takes another path.
