---
name: bench-typed-columns-against-the-per-base-extract
description: the obvious next step after the sub-pixel bin — write typed columns from the extract and delete the copy pass — is one the closest in-tree measurement scores as a LOSS, so it wants a bench arm before a rewrite
metadata:
  area: alignments, perf
  category: measure-first
---

# Bench typed columns against the per-base extract before rewriting it

The sub-pixel bin bounds how many entries the per-base extract emits; it does not
change their shape. At base-level zoom (`binBp === 1`) a deep pileup still builds
one `{readIndex, position, score|base}` object per aligned base, and
`buildArrays.ts` then copies the lot into typed arrays
([reference/PER_BASE_SUBPIXEL_BIN.md](../reference/PER_BASE_SUBPIXEL_BIN.md)).

The obvious next step is for the extract to write growable typed columns
directly and delete the copy pass. **The closest measurement in the tree says
that would be slower.** `plugins/alignments/benches/modExtract.bench.ts` measured
exactly this substitution for `ModificationEntry` and scored the columnar arm at
**3.379x against the shipped arm's 4.008x** — a loss — because the entry objects
are short-lived and die in the nursery, while growable columns pay doubling
copies and an intern lookup per push.

Three reasons it may not transfer, all untested, which is what makes this a
measurement rather than a closed question:

- **No string interning here.** A per-base entry is three numbers; the mod
  bench's columns paid a `type` intern per push.
- **Three fields, not eight.**
- **Scale and lifetime.** 148,045 mod marks die young; millions of per-base
  entries accumulate across every feature in the group and get promoted, which is
  the heap peak in the first place. "Dies in the nursery" is the mod bench's whole
  mechanism, and it is the part that most plausibly breaks.

**First move: copy `modExtract.bench.ts` as the harness**, including its rule
against a shared driver — a shared one has scored a byte-identical control at
1.14x in this repo. A bench arm first, then decide; not a rewrite followed by a
number.
