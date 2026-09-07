---
name: collecting-a-read-s-base-occurrences-to-make-the-reverse
description: Collecting a read's base occurrences to make the reverse MM walk use the forward `indexOf`
area: performance-and-measurement
---

# Collecting a read's base occurrences to make the reverse MM walk use the forward `indexOf`

the fastest thing measured on that walk, declined for a
regression its own fixtures could not show. Reverse reads step one base at a
time because V8 has no fast backward byte search; scanning FORWARD into an
occurrence list and indexing that from its end gets the fast builtin, and with
the list in a reused buffer it measured **1.366x / 1.758x** on the reverse
parse, positions identical (`benches/revCompScan.bench.ts`).

**It is conditional on something no fixture varies.** The forward arms cross
the entire read whatever the tag looks like, since the occurrences they need
are at the far end, while the stepping walk stops once it has placed the last
call. Both fixtures carry tags that span their reads, so both flatter it. The
bench's `--cluster` truncates a delta list to make the other shape:

| coverage | step | hitsArena | |
| --- | --- | --- | --- |
| 1.00 | 110.7 ms | 62.9 ms | 1.758x |
| 0.50 | 67.8 ms | 63.3 ms | 1.070x — break-even |
| 0.10 | 14.0 ms | 63.1 ms | **0.223x** |

Gating on it needs the fraction of the read the calls span, which is
`sum(deltas) + nPositions` against the read's occurrence COUNT — and that count
is precisely what the scan exists to compute. So every gate is a guess at base
composition with a magic constant in it, and its wrong answer is 4.5x slower.

**What would revive it is a cheap exact occurrence count.** BAM stores sequence
4-bit packed, two bases a byte, so a popcount-style tally over the packed form
would give it before the string is ever decoded — which is an adapter change,
not a change here.

Two smaller negatives from the same bench, both worth not re-deriving:
reverse-complementing the read to use the forward builtin **loses** (0.79x),
because building the reversed copy is an O(n) JS pass and the walk it replaces
is also O(n), so it starts a pass behind; and `TypedArray.indexOf` is a generic
element search that inherits none of `String.indexOf`'s speed (0.48x). htslib's
own shape — count, convert to indices from the start, one forward pass —
allocates nothing and still loses at 0.95x, because counting is itself a scan.
