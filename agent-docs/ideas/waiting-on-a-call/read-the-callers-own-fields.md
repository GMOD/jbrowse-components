---
name: read-the-callers-own-fields
description: Three INFO fields state what the app guesses or ignores, and none costs an inference. VCF 4.4's `SVCLAIM` marks a `<DEL>` or `<DUP>` as a depth claim or a junction claim, so a depth-only deletion should draw as a copy-number bar; `EVENTTYPE` names an `EVENT`'s class, which the event dropdown can print beside the id; and Severus spells `EVENT` and `MATEID` as `CLUSTERID` and `MATE_ID`, which the two readers of the standard keys can accept, retiring the sed recipe the SV inspector guide carries.
---

# Read the caller's own fields

Two of the fields are in the VCF 4.4 specification and one is a caller's own
spelling of a standard key. Reading them is the converter shape ADR-140 puts in
the tree, and the pictures they change are drawn today from less than the file
says.

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

## Severus's spellings

Severus writes `CLUSTERID` where the specification has `EVENT` and `MATE_ID`
where it has `MATEID`. Two readers look for the standard keys and nothing else:
`SpreadsheetModel.tsx` finds the event column by the literal `INFO.EVENT`, and
its docstring records that a caller with its own key "is renamed before import,
not recognised here"; `walkBreakendChain.ts` reads `info.MATEID` to pair a
record with its mate. `sv_inspector_view.md` therefore carries a four-line sed
recipe over the header and every record, and the cgiab tutorial's HG008-T
callset is a Severus callset, so every reader of that page with their own
Severus output runs the recipe first.

- The event column resolves to `INFO.EVENT`, then `INFO.CLUSTERID`; the
  dropdown and "open every locus of" read the resolved column unchanged.
- The mate id reads `MATEID`, then `MATE_ID`.
- The recipe leaves the guide, replaced by one sentence naming the spellings.

Two spellings at two sites, standard first. A third caller's key goes in the
same two places, and a caller writing no grouping is unchanged, since the walk
still orders its stops from the records.

## What it waits on

The `EVENTTYPE` label and the Severus spellings are prints and lookups and can
go first. The depth-claim drawing changes how an existing callset draws, which
is the call.
