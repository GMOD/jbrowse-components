---
name: read-svclaim-and-eventtype
description: VCF 4.4's `SVCLAIM` and `EVENTTYPE` are standard fields nothing in the tree reads. `SVCLAIM` marks a `<DEL>` or `<DUP>` as a depth claim or a junction claim, which is the standard's own separation of copy-number evidence from breakpoint evidence, so a depth-only deletion should draw as a copy-number bar and not as a junction. `EVENTTYPE` names an `EVENT`'s class, which the SV inspector's event dropdown and the split view's "open every locus of" can print beside the id.
---

# Read `SVCLAIM` and `EVENTTYPE`

Two VCF 4.4 INFO fields state something the app currently guesses or ignores.
Both are in the specification, so reading them costs no caller-specific code
and no inference.

## `SVCLAIM`: depth claim or junction claim

A `<DEL>` or `<DUP>` record carries `SVCLAIM=D` when the caller saw a change
in read depth, `J` when it saw a novel adjacency, and `DJ` for both. The
variant displays draw every deletion the same way today, so a copy-number
caller's depth-only deletion and a breakpoint caller's junction-backed one look
identical, and a reader comparing the two callsets in
`sv_visualization_cgiab` cannot tell which kind of evidence a bar stands on.

- A `D` record draws as a copy-number bar in the `CNV` colour, with no
  breakend feet and no split-view launch, since it names no junction.
- A `J` or `DJ` record keeps the junction glyph and the launch.
- The feature detail prints the claim in words, "depth" or "junction", above
  the raw field.
- The SV inspector's chord track already cannot draw DEL and DUP; a `D` record
  stays off the circle and a `J` one could join it.

`plugins/variants/src/shared/variantSvType.ts` resolves the class, and the
claim belongs beside it.

## `EVENTTYPE`: the class of an event

`EVENT` groups a rearrangement's records and the SV inspector reads it
(`SV_EVENT_COLUMN` in `SpreadsheetModel.tsx`). `EVENTTYPE` is the caller's
class string for that event, and the dropdown shows the id alone, so
`cluster_3` reads as a name and not as the chromoplexy the caller called it.
Print the class after the id in the event dropdown, in the split view's "open
every locus of" option and in the feature detail. The breakend walk reads
`EVENT` for its stops and needs nothing from the class.

## What it waits on

A call that the depth-claim drawing is wanted, since it changes how an existing
callset draws. The `EVENTTYPE` label is a print and can go first.
