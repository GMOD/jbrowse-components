---
name: chain-fields-on-the-main-thread
description: "View as pairs" stops being a fetch mode — chain identity is joined on the main thread (chainFields.ts, landed with its tests) and the worker still builds chains; what is left is wiring the display onto attachChainFields, stripping the worker's chain path, renaming the RPC facet, and the docs.
---

## Done

- The worker's two chain-mode gates are gone: chain mode fetches the bisulfite
  reference and runs the modBAM read-base pileup
  (`executeRenderAlignmentData.test.ts` pins both with `linkedReads`).
- `LinearAlignmentsDisplay/chainFields.ts` joins chain identity on the main
  thread: `attachChainFields(rawDataByGroup)` numbers chains per region
  (memoized on `readKeys` identity), unions them by NAME across every region
  and lane, and resolves `readChainHasSupp`, the per-mate `CHAIN_SPLIT_*`
  bits and a supplementary's `readPairOrientations` from the union.
  `buildReadIdsByChainName(byGroup)` is its by-product. 21 tests in
  `chainFields.test.ts`, including the cross-region oracle from
  `chainSuppAcrossRegions.test.ts`, the union split kind, and the
  supplementary-orientation case reachable through "View split alignment
  regions" with `colorSupplementaryChains` off. Nothing reads it yet.

## The grammar behind the names

Colin wants plugins/alignments to speak grammar-of-graphics, and "chain" is
his worked example of a custom notion that earns a place because it is simple:

| grammar term | here | today's spelling |
| --- | --- | --- |
| observation unit | a read, or a chain (mates + split segments, one QNAME) | `linkedReads: 'off' \| 'normal'`, `isChainMode` |
| facet | the field the sections stack by, and its domain (order) | `facet` slot on the model, `groupBy` on the RPC, `GroupBy` type |
| colour channel | `color` slot, resolved as `colorBy` | already renamed |

A facet partitions units, so what chain mode changes about a facet is the unit
it keeps whole — not a second kind of grouping. That is why `unit` lives on the
facet arg and why the worker keeps no other chain knowledge. The same reading
explains `isChainFacetable` (a facet a chain resolves to one key), the layout
(rows are units), and the split-read colouring (a property of the unit). Once
the wiring lands, the remaining second spellings are the `linkedReads` slot
(a `unit` slot would state it directly) and `isChainMode` (~30 sites).

## Decisions taken with Colin this session

- **"chain" is the observation unit the facet partitions**, in the
  grammar-of-graphics sense, not a grouping of its own. The RPC arg becomes
  `facet: { field, unit?: 'read' | 'chain' }` (default read); `unit: 'chain'`
  is sent only when chain mode is on AND a facet is in effect, so toggling
  pairs over ungrouped data leaves `rpcProps` equal and issues no fetch.
- **Drop the `By` suffix**: the model and config already say `facet`; rename
  the shared `GroupBy` type to `Facet`, the RPC arg `groupBy` to `facet`, and
  the `groupFeatures.ts` vocabulary (`groupByForMode` → `facetForMode`,
  `workerGroupBy` → `workerFacet`, `GROUP_BY_DIMENSIONS` → `FACET_DIMENSIONS`,
  `GroupByDimension`, `pickGroupByOptions`, `GROUP_BY_LABELS`/`groupByLabels.ts`).
  Leave the UI files named after the "Group by..." menu label
  (`groupByMenu.ts`, `GroupByDialog.tsx`, `getGroupByMenuItem`). Colin invited
  wide-ranging renames; the `linkedReads` config slot → `unit` is the next one
  and was NOT taken (a slot rename, decide separately).
- **A supplementary takes its primary's pair orientation only in chain mode.**
  Pileup mode keeps each record's own value.

## Left: the wiring commit

Files: `LinearAlignmentsDisplay/model.ts`, `groupLayout.ts`,
`computeChainLayout.ts`, `chainStrandConsensus.ts`, `groupedDataMaps.ts`,
`readLookup.ts`, `RenderAlignmentDataRPC/types.ts`,
`executeRenderAlignmentData.ts`, `shared/groupFeatures.ts`,
`shared/buildBaseFeatureData.ts`, `shared/webglRpcTypes.ts`, `rpcCalls.ts`,
`RenderAlignmentData.ts`.

- `RenderAlignmentDataRPC/types.ts`: the seven chain fields leave
  `WorkerPileupData`; add `interface ChainFields` (required),
  `interface ChainedPileupData extends WorkerPileupData, Partial<ChainFields>`
  (the layout's input tier, chain identity attached in chain mode), and
  `LaidOutPileupData extends ChainedPileupData, PileupLayoutArrays`.
  `isChainData` narrows the chained tier. `ChainPileupData` becomes
  `WorkerPileupData & ChainFields`. `linkedReads` leaves the args;
  `groupBy?: GroupBy` becomes `facet?: WorkerFacet` with `unit`.
- `model.ts`: a `chainAttachment` getter (`isChainMode ?
  attachChainFields(this.rawDataByGroup) : undefined`), `chainedByGroup`
  (`chainAttachment ?? rawDataByGroup`) feeding `groupLayoutContext.rawByGroup`
  and `fitRowCount`; `readIdsByChainName` reads
  `buildReadIdsByChainName(chainAttachment)` or an empty map.
  `rawDataByGroup`/`readArraysByGroup` stay chain-free so arcs, sashimi,
  coverage and the split view do not recompute on the toggle. `rpcProps`:
  `facet: workerFacet(self.effectiveFacet, self.isChainMode)`, no
  `linkedReads`; keep forcing `sortTag` undefined and `showSoftClipping` false
  in chain mode (chain layout reads neither). `setLinkedReads`' closing comment
  ("`linkedReads` is an `rpcProps()` key") is now false — the layout tier
  recomputes through MobX; `scrollTop = 0` and `clearMouseoverState()` stay.
  `readIdsSharingChain(rpcData)` takes the chained tier.
- `groupLayout.ts`: `GroupLayoutContext.rawByGroup` is the chained tier;
  `applyChainStrandFrames` loses the reconcile step (the union already made
  the frame one answer per chain) and keeps the consensus.
- Delete `chainSuppAcrossRegions.ts` + test, `shared/buildChainMetadata.ts` +
  test, `buildChainFeatureData`/`ChainFeatureData`,
  `groupedDataMaps.buildReadIdsByChainName` + its four tests, and in the worker
  `buildChainResultFields`, `isChain`, `effShowSoftClipping`, the sort-tag
  drop, the `groupByForMode` call (`GroupContext.isChain` goes, `sortTagValues`
  always ships). `partitionChains` folds into `partitionFeatures` under
  `facet.unit === 'chain'`; `groupFeatures.test.ts` has five `partitionChains`
  tests to re-spell.
- `products/jbrowse-web/src/tests/AlignmentGroupBy.test.tsx` (CI only) asserts
  `readChainIndices`/`chainNames` on `rpcDataMap` — move that assertion onto
  `display.chainedByGroup` or drop it; leave the canvas match.
- Pins to add in `model.coupling.test.ts`: toggling pairs ungrouped leaves
  `JSON.stringify(rpcProps())` equal and `laidOutByGroup` chain-laid at once;
  `rpcProps` differs under `tags.HP` (`unit: 'chain'` appears) and under
  `strand` (facet degrades to undefined). Existing tests there reading
  `rpcProps().groupBy` rename to `.facet`.
- `CHANGELOG.md`: `WorkerPileupData` is exported from `@jbrowse/plugin-alignments`;
  a plugin reading chain fields off `rpcDataMap` now gets `undefined`.
- Measure before landing: eight regions landing one at a time, 200k reads, min
  of a quiet run — `attachChainFields` per landing against today's
  `mergeChains` + reconcile + `buildReadIdsByChainName` + the `chainNames`
  clone. Name joins go 3 → 2, not 3 → 1.

## Left: docs

`RenderAlignmentDataRPC/CLAUDE.md` ("branching on `args.linkedReads`", the
group-by section's chain rules, "Chain numbering is per worker call"),
`LinearAlignmentsDisplay/CLAUDE.md` ("overwritten twice on the main thread",
`prefersOffset`'s `groupByForMode`), `agent-docs/mechanisms/split-read-chains.md`
rule 6 (the reconciler and the shared encoder are gone; the union is the
producer), `constants.ts`' `LINKED_READS_MODES` comment ("`!== 'off'` (the
worker, the menu row)"), `rendererTypes.ts`' `chainMode` comment, and this
plugin's `CLAUDE.md` line "`FeatureData` has no `name`. The QNAME is on
`ChainFeatureData` only" (chain mode now reads names off the block via
`readNameAt`).

## Traps met

- Main's pre-commit banner reports a stale generated artifact from other
  landings (graph plugin docs over the two demo configs); not this thread's.
- The session's command guard refuses heredocs; edit with the file tools.
- `readCounts[c]!++` is the repo's spelling for a non-null element increment.
