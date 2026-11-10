---
name: read-severus-spellings-and-print-the-eventtype
description: The SV inspector and the breakend walk read only `EVENT` and `MATEID`, so a Severus callset (`CLUSTERID`, `MATE_ID`) needs a sed recipe first, and the event dropdown shows `cluster_3` without the `EVENTTYPE` that says it is a chromoplexy.
---

# Read Severus's spellings and print the `EVENTTYPE`

Both are prints and lookups over fields the file already states; split from
[read-the-callers-own-fields](../waiting-on-a-call/read-the-callers-own-fields.md),
whose remaining fields change how a callset draws.

## Severus's spellings

Severus writes `CLUSTERID` where the specification has `EVENT` and `MATE_ID`
where it has `MATEID`. Two readers look for the standard keys and nothing else:
`SpreadsheetModel.tsx` finds the event column by the literal `INFO.EVENT`
(`SV_EVENT_COLUMN`), and `packages/sv-core/src/walkBreakendChain.ts` reads
`info.MATEID` to pair a record with its mate. `sv_inspector_view.md` therefore
carries a sed recipe over the header and every record, and the cgiab tutorial's
HG008-T callset is a Severus callset, so every reader of that page with their
own Severus output runs the recipe first.

- The event column resolves to `INFO.EVENT`, then `INFO.CLUSTERID`; the
  dropdown and "open every locus of" read the resolved column unchanged.
- The mate id reads `MATEID`, then `MATE_ID`.
- The recipe leaves the guide, replaced by one sentence naming the spellings.

Two spellings at two sites, standard first. A third caller's key goes in the
same two places, and a caller writing no grouping is unchanged, since the walk
still orders its stops from the records.

## `EVENTTYPE`: the class of an event, in words

`EVENT` groups a rearrangement's records and the SV inspector reads it.
`EVENTTYPE` is the caller's class string for that event. Core's `svClassOf`
(`packages/core/src/util/svAlt.ts`) already reads it to class a breakend, but
the dropdown shows the event id alone, so `cluster_3` reads as a name and not
as the chromoplexy the caller called it. Print the class after the id in the
event dropdown, in the split view's "open every locus of" option and in the
feature detail. The breakend walk reads `EVENT` for its stops and needs nothing
from the class.
