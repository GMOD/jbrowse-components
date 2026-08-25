---
name: maf-row-synteny-launch
description: A MAF row over a drag selection is already a gapped pairwise alignment, so "launch a synteny view of the anchor against this sample" needs no adapter — synteny features with a CIGAR cut from the gapped columns, in a FromConfigAdapter track, opened the way read-vs-ref opens. What the MAF menu offers today, what the v1 is, and why the all-samples stack is a second step.
---

# Launch a synteny view from a MAF row

## What the MAF menu offers today

`LinearMafDisplay`'s drag-selection right-click
(`plugins/maf/src/LinearMafDisplay/components/SubsequenceContextMenu.tsx`)
lists the subsequence widget and, per species with a loaded assembly, **Open
\<sample\> \<locus\> in new view** (`sampleNavigationItems.ts`,
`openSampleInNewView.ts`). Past six rows the entries fold into a submenu. That
opens a plain LGV on the sample's genome: it says where the row's bases live,
and nothing about how they align to the anchor, which is the thing the MAF
holds.

## Why no adapter is needed

`AlignmentRecord` (`plugins/maf/src/types.ts`) carries, per block and sample,
`chr`, `start`, `strand`, `srcSize` and the gapped `seq`; the anchor's gapped
sequence is on the same block. Walking the two gapped strings column by column
gives a CIGAR (`=`/`X` where both have a base, `I` where only the sample does,
`D` where only the anchor does), and the block's anchor span plus the sample's
`start` and strand place it. That is a synteny feature with a `mate` and a
`CIGAR`, which is what `LinearSyntenyDisplay` draws and `resolvePanel` walks.

`buildReadVsRefSpec.ts` (`LinearReadVsRef/`) already builds exactly this shape
for a read: a `SyntenyTrack` over a `FromConfigAdapter` whose `features` carry
both sides of each alignment, and a `LinearSyntenyView` snapshot with two
`LinearGenomeView` rows. The MAF version differs in where the bottom row's
sequence comes from:

- **sample assembly loaded** (`source.assemblyName` set, which is what
  `rowNavigationTarget` already gates on): the bottom row is that assembly, and
  the synteny track's `assemblyNames` are `[anchor, sample]`.
- **not loaded**: the read-vs-ref synthetic-assembly path — `buildSyntheticAssembly`
  over the sample's ungapped bases concatenated across blocks, with the mate
  coordinates in that synthetic frame. Less useful (no gene track can join it)
  but it works for every row, not just the ones with an assembly behind them.

## The v1

One item per navigable row beside the existing "open in new view" one, or a
second submenu past the fold: **Launch synteny view: \<anchor\> vs \<sample\>**.
Features are built on the main thread from the display's fetched blocks (the
same `rpcDataMap` the navigation target reads), so nothing crosses the RPC.
The dialog is `SyntenyLaunchDialog` with the window-size field and the two
ways out; there is nothing to resolve or discover, so no panel list.

## The all-samples stack, and why it is a second step

A stack with the anchor on top and every sample below draws bands between
ADJACENT rows only, so row 2 vs row 3 is sample-vs-sample and the per-row
features above say nothing about it. The columns do: two samples' gapped
strings on one block are column-aligned through the anchor, so a
sample-vs-sample CIGAR is the same walk over a different pair of strings. That
makes an N-row stack N-1 synthetic tracks, each built from a pair of rows, and
the anchor-in-the-middle argument from the grape tutorial does not apply —
every band is direct. It is a second step because it changes what the launch
builds (one track per gap rather than one track), and because a MAF with 464
haplotypes needs the row selection the dialog's checkbox list gives before a
stack is a picture at all.

## What it is not

Tiered MAF ([ortholog-navigation](ortholog-navigation.md)) is the other
direction — MAF blocks preprocessed into a synteny track on disk. This is the
live, per-selection version, and needs no preprocessing.
