---
name: read-the-callers-own-fields
description: VCF INFO fields that say what kind of evidence an SV call stands on (`SVCLAIM`) and where its breakpoint may be (`CIPOS`/`CIEND`, `IMPRECISE`, `HOMSEQ`), which every drawing ignores, so a depth-only deletion and an imprecise breakend draw like base-precise junctions.
---

# Read the caller's own fields

Both sets of fields are in the VCF 4.4 specification. Reading them is the
converter shape ADR-140 puts in the tree, and the pictures they change are
drawn today from less than the file says. The `EVENTTYPE` label and Severus's
spellings, which are prints and lookups, are
[their own doc](../ready/read-severus-spellings-and-print-the-eventtype.md).

## `SVCLAIM`: depth claim or junction claim

A `<DEL>` or `<DUP>` carries `SVCLAIM=D` when the caller saw a change in read
depth, `J` when it saw a novel adjacency, and `DJ` for both. The variant
displays draw every deletion the same way, so a copy-number caller's depth-only
deletion and a breakpoint caller's junction-backed one look identical, and a
reader comparing the two callsets in `sv_visualization_cgiab` cannot tell which
kind of evidence a bar stands on.

- A `D` record draws as a copy-number bar in the `CNV` color, with no
  breakend feet and no split-view launch, since it names no junction.
- A `J` or `DJ` record keeps the junction glyph and the launch.
- The feature detail prints the claim in words above the raw field.
- The SV inspector's chord track cannot draw DEL and DUP today; a `D` record
  stays off the circle and a `J` one could join it.

Core's `svClassOf` (`packages/core/src/util/svAlt.ts`) resolves the class, and
the claim belongs beside it.

## `CIPOS`, `CIEND`, `IMPRECISE` and `HOMSEQ`: where the breakpoint may be

No app code reads them. The variant widget prints them as plain INFO with their
reserved descriptions, so they are one click away, but every drawing places a
breakend at `POS` exactly: a discordant-only short-read call good to a few
hundred bases draws the same foot as a base-precise one.

- Draw the stated interval in the variant display's own glyph, so every panel
  of the split view and the LGV shows it and the split view's overlay stays one
  mark. A solid span, not a dash.
- Only an `IMPRECISE` call's interval shows at the split view's default zoom
  (10 bp/px); a precise call's few bases do not.
- A microhomology lets an aligner place one junction anywhere along it, which
  may be why split-read arcs at one junction land a few bases apart under
  `arcKey`'s exact-coordinate rule. Unchecked; look at a call with `HOMLEN`
  before drawing it as the reason.
- Some callers write `CIPOS` on a precise call to span its homology rather than
  an uncertainty; read the header's description, keyed on `IMPRECISE` and
  `HOMLEN`, before drawing it as one.

## What it waits on

Both drawings change how an existing callset draws, which is the call.
