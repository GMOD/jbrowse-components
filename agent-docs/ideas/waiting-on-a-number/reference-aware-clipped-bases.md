---
name: reference-aware-clipped-bases
description: Shown soft clips paint every base, so a tail matching the reference past a breakpoint looks as loud as one that does not. Giving the clip layer the mismatch layer's filter and opacity would quiet it; measure how much clipped sequence matches first.
---

# Reference-aware clipped bases

**Show soft clipping** paints every clipped base in its base color, as IGV and
v4 do. A clip that runs on into sequence the reference also has (a repeat, a
microhomology, a misaligned tail) draws as loudly as a real novel junction.

## The shape that survived review

- Not a new layer or slot. The softclips layer takes the two things the mismatch
  layer already has: a filter (base differs from reference) and quality opacity
  under `pileup.mismatches.encoding.opacity`, in line with
  [ADR-149](../../architecture-decision-records/adr-149-the-per-base-layer-is-its-own-color-object.md)'s
  refusal of a per-mark `layers` list. It replaces today's drawing outright; the loss is
  reading a clip's full sequence off the pileup.
- The bases stay in the softclip arrays, not the mismatch arrays, or they enter
  SNP coverage and the frequency fade.
- The clamp in `features/softclipBases/buildArrays.ts` already limits the bases
  to the fetched region, so the reference needed is exactly `region`, one
  `fetchReferenceSequence` call.
- Matching bases need a body tint distinguishable from aligned body, or a
  reference-matching tail reads as aligned while coverage says it is not.
- Hit testing must use the clip span, or hovering a matching base hits nothing.

Each of these needs a test: a soft-masked reference (compare
case-insensitively, as `buildArrays.ts` already uppercases CRAM bases), no
reference (paint every base, never "all match"), and missing qualities, which
must pack as unavailable (`features/mismatch/mark.ts`).

## The number that decides it

The share of clipped bases at real breakpoints that match the reference at
their drawn position, on short and long reads. Near zero, the change quiets
nothing; large, it is the difference between a readable breakpoint and a
painted wall.
