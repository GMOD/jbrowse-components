---
name: brand-the-out-of-request-refnames
description: the out-of-request refNames still typed plain `string` — VCF breakend partners, synteny's dictionary lanes, chord ends, split-read segments — and what each needs before `AdapterRefName` can reach it
---

# Brand the rest of the out-of-request refNames

`AdapterRefName` is built and covers the alignments mates, SA records and
synteny's span answer.
[reference/REFNAME_NAMESPACES.md](../../reference/REFNAME_NAMESPACES.md) says
what it is, where it is minted, and why it is opaque rather than
`string & {…}`. What follows still carries the file's spelling as a plain
`string`. Each one canonicalizes correctly today, so branding it is a
type-only change.

- **VCF breakend partners** (`@jbrowse/sv-core`): `junctionEnds`,
  `FeatureEnd`, `toCanonicalRefName`, and their readers in the breakpoint split
  view (`findFeatureViewLevel`, `variantPaths`). Both ends of a `FeatureEnd`
  carry the file's spelling, and `pairedEndsLocString` compares them with each
  other, which is safe. The ALT partner wants `AdapterRefName`. Check whether
  the own end, `feature.get('refName')` on the main thread, is canonical first.
  If it is, `own.refName === mate.refName` already straddles.
- **Synteny's dictionary lanes** (`refNameDict` / `mateRefNameDict`):
  `canonicalizeSyntenyDictLanes` is typed `T -> T` over the generated
  `SyntenyFeatureLanes`, so an adapter-space payload and a canonical one share a
  type. Branding needs `scripts/generateSyntenyLanes.ts` to emit the lanes'
  pre-rename and post-rename shapes. `renameOffscreenMates` and the multi-way
  display's own canonicalizers (`MultiWaySyntenyDisplay/model.ts`) go with
  them.
- **Chord ends** (`BaseChordDisplay.placeEnd`, `canonicalRefName`): both ends
  "as the adapter wrote it", so the parameter can take `AdapterRefName` once the
  chord feature readers mint it.
- **Split-read segments** (`AlignedSegment`, `splitAlignmentSegments`): mixes
  the read's own fetched refName with its SA records' refNames in one array, so
  one field type cannot describe it. Splitting the own segment from the SA ones
  is the prerequisite. `viewSplitAlignmentRegions` canonicalizes every segment
  through `clampToListedContig`, so nothing is wrong today.
- **`featurizeSA` itself**: `@jbrowse/cigar-utils` does not depend on
  `@jbrowse/core`, so the parser returns `string` and each reader mints. Moving
  the mint into the parser needs the brand to live somewhere cigar-utils can
  import.
- **`offscreenMateNav`**, **`LaunchSyntenyView/visibleSpanOnRefName`**: each
  canonicalizes a synteny mate name inline.

Not wanted: the gwas `indexSnp`. It is user text held in MST state and resolved
through `getCanonicalRefName2`, not an adapter answer. The SAM export
canonicalizes RNAME and RNEXT and compares neither.
