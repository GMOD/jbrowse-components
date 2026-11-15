---
name: split-arc-hover-words-its-distance-by-class
description: A split arc's hover could say how its two pieces sit on the reference by class and print the read bases between them as a min-max over the arc's reads, but the read gap lives only on the pending arc. Count how often the reads coalesced onto one arc disagree on their read gap first.
---

# A split arc's hover words its distance by class

An insertion-class split arc's hover prints no Distance line: "Distance: 14 bp"
beside "Type: Split read (insertion)" read as a 14 bp insertion, when it was the
overlap or miss of the two pieces on the reference. Every other split arc still
prints the bare `end − start`.

## The full version

Each class words its distance, and every split arc prints the read bases between
its pieces, as a min-max over the arc's reads:

```text
Read connection
Location: chr20:10,001,201-10,003,200
Reference skipped: 2,000 bp
Read bases between the two pieces: 0
Supported by 12 reads
Type: Split read (deletion-type)
```

```text
Read connection
Location: chr20:10,001,201-10,006,400
Reference the read steps back over: 5,200 bp
Read bases between the two pieces: 0
Supported by 3 reads
Type: Split read (duplication-type)
```

```text
Read connection
Location: chr20:10,001,201-10,001,215
Read bases between the two pieces: 305–320 bp
The pieces overlap on the reference by 14 bp
Supported by 4 reads
Type: Split read (insertion)
```

- The insertion's fourth line's other forms: "The pieces sit 3 bp apart on the
  reference" and "The pieces meet on the reference".
- A negative read gap prints as 0; the "Split segments overlap" mark already
  shows shared bases.
- Inversion arcs keep "Distance" and gain the read-bases line.
- No computed size: ADR-258 records SVLEN matching `readGap − refGap` in one
  group and `readGap` elsewhere.

## Why it is parked

`readGap` lives on `SplitPendingArc` only (`features/arcs/arcTypes.ts`).
`ComputedArc`, `arcKey`, `ArcsUploadData` and `ArcHit` do not carry it, and an
insertion arc's sign of `refGap` (overlap or miss) is not recoverable from the
hit, which has no strand. So `ComputedArc` has to carry the read-gap range and a
signed `refGap` through `features/arcs/compute.ts`, `arcTypes.ts`, `types.ts`,
`arcRegions.ts`, `bandFeed.ts` and the tooltip.

## The number that decides it

Reads coalesce onto one arc by feet, color, shape and span, so an arc of N reads
has N read gaps. Count, on long-read insertion and deletion calls, how often
those gaps differ across one arc. If they rarely do, a single number on the
hover is honest and the range is not worth carrying.
