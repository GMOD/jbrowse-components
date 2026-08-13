---
name: handoff-hic-dataview-range-error
description: Live state of the unresolved `RangeError: Offset is outside the bounds of the DataView` thrown by the hic adapter during the hic/whole_genome capture. Not blocking figures, and the reason it is not blocking is also the reason it is easy to dismiss wrongly.
---

# Handoff: hic whole-genome DataView RangeError

Found by the full figure sweep on 2026-08-13, not by a test or a bug report.
Nothing has been fixed and nothing has been filed, because the thread stops at
"this is real, and here is the one question that decides what it is".

## The symptom

One line, from the browser console during the capture of `hic/whole_genome`:

```
[hic/whole_genome] browser[error]: RangeError: Offset is outside the bounds of the DataView
```

`browser[error]`, not `browser[warn]`. It is the only hic spec that produced it:
`hic/percentile_off`, `hic/percentile_on`, `hic/overlay_controls` and `hic_track`
all captured in the same run without it.

## What is established

- **The figure is unchanged.** The sweep re-rendered it and kept the committed
  PNG at `0.000%` difference. It is not a blank-figure case, and no
  `DISPLAYS NOT PAINTED AT CAPTURE` was reported for it.
- **The spec is `hic/whole_genome`**, defined in `website/scripts/specs/alignments.ts`
  (not `specs/hic.ts`, which is where it reads like it should be).
- **It is whole-genome only.** The three windowed hic specs are clean, which
  points at the multi-region path rather than at hic decoding generally.

## What is NOT established, and matters most

**`0.000%` proves stability, not correctness.** If the error drops data, and the
committed PNG was captured under the same error, then both renders are wrong in
the same way and a pixel diff cannot see it. The committed figure is evidence
that the output has not *changed*; it is not evidence that it is right. This is
the trap `website/CLAUDE.md` describes as a plausible-looking figure.

So the picture being fine is not a reason to close this.

## The first question to answer

**Is it a regression?** Four recent commits touch exactly the machinery a
DataView overrun would come from, and the wording of two of them is close enough
to the symptom to be worth reading before anything else:

- `6ad8d49cbe` fix(hic): the multi-region fetch path was sized and ordered for one region
- `9a85d176b0` perf(hic): overlap the two independent read chains a region pair issues
- `87b22d5110` perf(hic): pack the shader's instance layout in the worker, drop the bin columns
- `d20c1bb006` fix(hic): a node-only test helper was being built into the browser bundle

"Sized and ordered" and "overlap the two independent read chains" are both
descriptions of things that produce an out-of-bounds read when they are half
right. Whole-genome is the multi-region case, and it is the only one failing.

The cheap way to settle it is to re-run the one spec against a checkout from
before that run of commits, rather than to reason about the diffs.

## Reproducing it

From `website/`, with a current `products/jbrowse-web/build` (the generator
serves the build, so a stale build reproduces stale code):

```
TMPDIR=/tmp/ss node scripts/generate-screenshots.ts --filter hic/whole_genome
```

`--filter` implies `--force`, so this rewrites the PNG; check it out again
afterwards if the render is unchanged.

**The log carries no stack trace**, only the message, which is why this handoff
cannot name the offending read. Getting one is the next mechanical step:
`--headed`, or a `page.on('pageerror')` that prints `error.stack`.

## Where to look

`plugins/hic/src/HicAdapter/hic-straw/` constructs a `DataView` in ~15 places.
`binary.ts` is the parser every one of them feeds; `hicFile.ts:593` is the only
one that passes an explicit `byteOffset`/`byteLength` rather than wrapping a
whole buffer, so it is the one whose bounds can be wrong without the buffer
being wrong.

## Related, and deliberately not folded in

The same sweep surfaced other failures. They are noted here so the next person
does not rediscover them, and so the one that is *not* separate is not filed
twice:

- **`protein/connected` fails hard** — `TypeError: Cannot read properties of
  undefined (reading 'filter')`, reported by the generator as
  `capture not settled ... Failed to launch ProteinView view`. Unlike the hic
  one this does block its figure. Unrelated to everything else here.
- **`multisv_rhd_dosage` is not a bug** — `Failed to fetch` on two
  `ftp.sra.ebi.ac.uk` CRAMs. Someone else's outage, which is the reason the
  sweep is weekly rather than a PR gate.
- **The MST liveliness warnings and `no containing view found` are one bug,**
  not two. The warnings appear on `replaceView()`, `removeView()` and
  `addSessionAssembly()` across several synteny, dotplot and cancer_sv specs;
  `cancer_sv/multihop_split_view` then throws `Error: no containing view found`
  into an ErrorBoundary, and its subsequent `hover target not found:
  [aria-label="JBrowse"]` says the app header was gone, i.e. the crash took the
  page rather than one lane.

  The mechanism is ADR-069's, and it is legible end to end:
  `getContainingView` (`packages/core/src/util/mstUtils.ts:108`) finds a view by
  walking parents and throws when there is none, so a display React is still
  rendering after its view was destroyed fails that walk. That is precisely the
  escalation ADR-069 describes, from liveliness warning on an already-read
  property to a hard throw on a node whose parent is gone. Worth fixing as one
  thing.
