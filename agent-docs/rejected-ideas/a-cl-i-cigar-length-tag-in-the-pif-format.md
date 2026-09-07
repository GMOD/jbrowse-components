---
name: a-cl-i-cigar-length-tag-in-the-pif-format
description: A `cl:i:` CIGAR-length tag in the PIF format, so the reader can jump the `cg:Z:` value instead of scanning it
area: performance-and-measurement
---

# A `cl:i:` CIGAR-length tag in the PIF format, so the reader can jump the `cg:Z:` value instead of scanning it

measured 2026-08-20 and declined on
price. The parse has to find the tab that ENDS the CIGAR, which on a fine-tier
row means touching ~1.8kB it otherwise never reads (the value it keeps is a
sliced string, O(1)); writing the length beside it in `make-pif` turns that
scan into arithmetic, and unlike an ordering invariant it degrades safely —
a file without the tag takes the scan. It works, and it is small: **1.257x
against a control of 1.000x** on 4,000 hs1-vs-mm39 fine rows.

That 1.257x is of the tag loop, which is 0.49 µs of a 1.4 µs row. The whole
change is therefore **~7% of the read path**, and it is 7% that only reaches a
user who regenerates their PIF files — against 1.6-2.2x that reached every
existing file the day it landed. A format invariant whose sole consumer is a
parser fast path is also the kind that rots quietly. Re-open it if the parse
ever dominates again. Re-measuring it is a fifth arm in `pafLineParse.bench.ts`
that reads the CIGAR's start and length out of a precomputed array, which
prices the bound without writing either the tag or the generator half.
