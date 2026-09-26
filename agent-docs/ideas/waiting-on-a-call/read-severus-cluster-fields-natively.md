---
name: read-severus-cluster-fields-natively
description: Severus writes `CLUSTERID` where the specification has `EVENT` and `MATE_ID` where it has `MATEID`, so the SV inspector guide carries a sed recipe the reader runs before the event dropdown and the breakend walk see the caller's grouping. Recognising the two spellings at the two places the standard keys are read retires the recipe, and it is the converter shape ADR-140 puts in the tree.
---

# Read Severus's cluster fields natively

Two readers look for the standard keys and nothing else:

- `SpreadsheetModel.tsx` finds the event column by the literal
  `INFO.EVENT` (`SV_EVENT_COLUMN`), and its docstring records that a caller
  with its own key "is renamed before import, not recognised here".
- `walkBreakendChain.ts` reads `info.MATEID` to pair a record with its mate.

`sv_inspector_view.md` therefore carries a four-line sed recipe that rewrites
the header and every record of a Severus VCF before the file is opened. The
cgiab tutorial's HG008-T callset is a Severus callset, so every reader of that
page who brings their own Severus output runs the recipe first.

## The change

- The event column resolves to `INFO.EVENT`, then `INFO.CLUSTERID`. The
  dropdown and the split view's "open every locus of" read the resolved
  column and need no other change.
- The junction's mate id reads `MATEID`, then `MATE_ID`.
- The sed recipe leaves the guide, replaced by one sentence naming the two
  spellings the reader no longer has to rename.

Two spellings, at two sites, with the standard one first. A third caller's
key goes in the same two places, and a caller that writes no grouping at all
is unchanged, since the walk still orders its stops from the records.

## What it waits on

A call that caller-specific spellings are read at the reader. ADR-140 puts a
converter for another tool's output in the tree, and this is the smallest one.
