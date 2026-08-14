---
name: two-axis-synteny-fetch
description: Restoring the original both-rows synteny fetch joined on `syntenyId`, which the single-axis fetch replaced. Recovers the alignments a single-axis fetch structurally drops, and would retire synteny's two return-direction refName renames — the second of which is no longer an argument for it, since those renames are now written and cheap. Blocked on one thing, a perspective-stable id for PIF. Read before proposing either half.
---

# Fetch both synteny axes again, joined on `syntenyId`

The synteny fetch queries **one** axis (`executeSyntenyFeaturesAndPositions`:
"The query is on v1 (the query axis) only"). It did not always: an earlier
design requested from both the top and bottom `LinearGenomeView` rows and joined
the two results on a shared `syntenyId`.

That key still exists. `plugins/comparative-adapters/src/util.ts` emits

```ts
uniqueId: fileOffset + assemblyName,   // deliberately DIFFERENT per perspective
syntenyId: fileOffset,                  // deliberately the SAME
```

and `MCScanSimpleAnchorsAdapter.test.ts` pins the contract — `q.id()` differs
from `t.id()` while `q.get('syntenyId')` equals `t.get('syntenyId')`. MCScan,
BLAST and the in-memory PAF path all emit it. What was removed is the fetch that
used it, not the mechanism.

## Two things it buys

**It removes synteny's need for a return-direction rename.** See
[REFNAME_NAMESPACES.md](../reference/REFNAME_NAMESPACES.md): a one-way rename is
sufficient exactly while an answer describes a region the caller asked for, and a
single-axis fetch returns answers about two locations having requested one. With
both axes requested, each side positions features inside blocks it asked for —
structurally identical to an ordinary LGV display — and the mate refName stops
being information at all.

Not a reason to do this, and it was never the strongest one: the two renames
synteny needs now exist and are a few dozen dictionary entries per fetch. What
this would buy is deleting them, and the other five plugins would still have
their own. Justify this change by the alignments it recovers, below.

**It recovers alignments the current fetch drops.** The same code comment admits
the class: "an alignment whose query coords sit outside this window but whose
mate is on-screen in v2." Today those are simply absent.

## The blocker, narrower than the comment says

`executeSyntenyFeaturesAndPositions.ts` says a two-axis fetch "can't dedupe q-
against t-perspective rows (PIF gives them distinct file offsets, hence distinct
feature ids)." True of **ids** — but ids are distinct on purpose, and `syntenyId`
is the key that joins them.

The real blocker is PIF alone: its two perspectives are separate indexed
records, so `fileOffset` — and therefore `syntenyId` — genuinely differs there,
where for MCScan (`rowNum`) and BLAST (`i`) one source row generates both
perspectives from one index and the join works today. Fixing PIF means giving
both of its rows a perspective-stable key: the query-perspective offset carried
on both, or a hash of the alignment tuple.

*Unverified:* the PIF specifics above are inferred from `syntenyId: fileOffset`
and the shape of the format, not from reading
`PairwiseIndexedPAFAdapter`'s record generation. Check that first — it is the
whole feasibility question.

That comment should be narrowed regardless of whether this is built. As written
it reads as "cross-perspective dedupe is impossible", which is not what the
codebase does.

## Justify it on the dropped alignments, not on refNames

The refName class has a small fix (canonicalize two channels on receipt, the
same workaround five other plugins already use) and this is a large change. It
also would **not** finish that job: `SyntenyResolveMatchingRegion` asks "where
does this alignment put the other end", which is inherently an answer about a
location the caller did not request, and still needs the inverse rename.

So the case for this is fetch **completeness**. The refName class dissolving is
a bonus, and pitching it the other way round buys an architecture change with a
bug that has a cheaper fix.

## Costs to weigh

- Two fetches per level instead of one, against a whole-genome PAF.
- The dedupe moves from `f.id()` to `syntenyId`, which has to hold across
  every adapter, not just the three that emit a joinable one today.
- Feature ids are already not comparable across a tiered PIF's two tiers
  (`setRpcData`'s comment, and `lodMode` on the resolve RPC). A cross-perspective
  key has to survive that too, or it reintroduces the same trap one level down.
