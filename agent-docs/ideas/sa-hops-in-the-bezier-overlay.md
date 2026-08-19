---
name: sa-hops-in-the-bezier-overlay
description: The bezier connector overlay never reads SA tags, so a read whose middle segments are off screen gets a direct arc between the two that are left — a junction that does not exist, drawn as a plain inversion, while the arc band suppresses it and the split view dashes it. Plus the one-ended hops nobody draws, and the shared `Chain` type that lost the caller it was proposed for.
---

# SA hops in the bezier overlay

This file was `multi-hop-fusion-chaining`, a four-phase proposal for showing
cancer multi-hop rearrangements the way
[SplitThreader](https://github.com/marianattestad/splitthreader) does. Two of its
phases shipped in August 2026 as the derivative-allele picker, in a shape the
proposal did not anticipate; two of its open decisions were answered by a rule
rather than by a design. What is left is one correctness bug, one additive
feature behind it, one refactor whose justification the shipping took away, and
one small live finding.

Read [`reference/SV_MULTIHOP.md`](../reference/SV_MULTIHOP.md) before starting
any of it — it carries the line this feature area does not cross, and the three
questions that killed the last idea in it.

## Shipped — do not re-propose

**A multi-read linearized allele, both panels.** The
`Reconstruct derivative allele...` track-menu item on `LinearAlignmentsDisplay`
lists the candidate paths and launches either view, from
`plugins/linear-comparative-view/src/LinearDerivativeVsRef/`:
`buildDerivativeVsRefSpec` builds the query-space axis with ribbons to the
reference (the proposal's panel B), and `buildSplitViewFromPath` builds a
breakpoint split view with **one panel per segment**, so a path that leaves chr9
and returns to it inverted gets two chr9 panels rather than one that quietly
merges the two visits.

**Junction consensus.** `computeDerivativePaths`
(`plugins/alignments/src/features/derivativePaths/computePaths.ts`) groups the
chains in view by the path their junctions describe and ranks the groups by how
many independent reads describe each. It gets those chains by calling
`unpairedReadChain` from `features/arcs/arcChains.ts` — the existing arc builder,
unchanged — which is the reason no shared `Chain` type was needed to get there.

**What the fusion contig is built from** is settled in both directions. Offline,
`scripts/sv_multihop.py derive` polishes the spanning reads into a consensus and
realigns them onto it. In-app, nothing is built: `projectReadsOntoDerivative`
placed each supporting read onto the path and was reverted in `e7b4f2b29b`,
because its evidence was the same chains the path came from.

**Aggregation scope** is settled too: main-thread over the reads already in view
(`derivativePathCandidates` reads `rawDataByGroup`), no worker scan.

---

## Bug: the overlay draws a junction that is not there

**The bezier overlay path never reads `readSuppAlignments`** — grep it across
`features/linkedReads/`, `shared/readGroupConnections.ts` and
`components/pileupBezierArcs.ts` and there are no hits. It groups the *fetched*
alignments by QNAME, sorts each read's segments by clip-at-start, and joins
consecutive ones (`splitJunctions`). When the segments between two of them were
never fetched, it joins across the gap anyway and says nothing.

That is not a hypothetical. Measured with a COLO829-chain-1-shaped fixture — one
unpaired read, chr3 fwd → chr10 → chr12 → chr3 rev, with only the two chr3
segments fetched — `enumerateBezierPairs` returns one pair and
`computePileupBezierArcs` returns one arc:

```
M 25359568 5 C … 25359111 17     label: "Split alignment (inverted)"
```

A single inversion junction on chr3, at full opacity, indistinguishable from a
real one. The read's actual structure is a foldback through 382 bp on two other
chromosomes.

### The other two renderers already handle this, differently

| Renderer | Two on-screen segments with hidden ones between | A hop with only one end on screen |
| --- | --- | --- |
| Coverage arcs (`features/arcs/`) | **suppressed** — `unpairedChainArcs` walks the SA-augmented chain, so the two are not adjacent and no junction is emitted between them | same-chr: the arc keeps its real geometry and the leg rises at the on-screen foot, running off the block edge (`arcTouchesRegion`). Interchromosomal: a **tick** at the on-screen foot naming the far chromosome (`resolveArcs`, inside `if (p1Ref !== p2Ref)`) |
| Breakpoint split view | **drawn dashed** — `markHiddenSegments` fills `hiddenSegmentsBetween`, `AlignmentConnections` sets `strokeDasharray='4 3'` and the tooltip reads `hidden N segments not in view: <locstrings>` | n/a — every panel is a locus somebody asked for |
| Bezier overlay | **drawn solid, unmarked** | nothing |

So the overlay is the only one of the three that asserts an adjacency it has not
checked. `unpairedChainArcs`' own comment names the behavior it is avoiding —
*"this is also what suppresses a misleading direct join across an off-screen
segment (the flanking pair are not actually read-adjacent)"* — and the overlay is
where that join is drawn.

### Fix it in the order the renderers disagree

**Step 1, the correctness half.** Give the bezier path the SA-augmented chain and
mark the arcs that span a hidden segment. The chain builder already exists —
`unpairedReadChain(entries, canonicalRefName)` — and `resolveReadGroup<E, T>` is
already generic over the per-mate chainer precisely so the two paths can differ
here; its comment says so: *"the bezier path chains only the on-screen segments
(`splitJunctions`), the arc path additionally walks off-screen SA segments."*

Copy the split view's answer rather than the arc band's: **dash the arc and name
the hidden loci**, because the overlay is a per-read mode where the user is
following one molecule and deleting its connector loses the thread, whereas the
arc band is an aggregate where a wrong junction would be counted. The overlay
already has the tooltip channel — `arcTooltip` → `setMouseoverExtraInformation`
in `PileupBezierOverlay` — so the locstrings have somewhere to go.

This needs no new geometry, no anchor decision and no new setting. It is where to
start.

**Step 2, the additive half: one-ended hops.** A hop whose far end was never
fetched has no `x` (`bpToScreenX` returns `undefined`) and no `y` (no `readYs`
row). Both answers already exist one band up, split by the same test the overlay
already computes in `classifyPair` (`interchromOf` → `LINKED_READ_COLOR_INTERCHROM`):

- **Same chromosome** — keep the real geometry and let the curve run off the
  panel, as `arcTouchesRegion` does. The overlay cannot do this today for a
  reason worth knowing: the arcs project absolute genomic bp inside a region
  block, so an off-block coordinate lands off-block naturally, while
  `makeBpToScreenX` delegates to `view.bpToPx`, which returns `undefined` for any
  coordinate no displayed region covers. An extrapolating projector is the
  concrete missing piece.
- **Interchromosomal** — a foot mark on the read's own row naming the far
  chromosome, the tick's job in the band above.

The old A1 (baseline drop) / A2 (edge clamp) / A3 (multi-region only) options are
superseded by that split: A2 is the same-chr answer done worse (a clamp invents a
position where extrapolation does not), and A1 invents a fourth vocabulary for
something the display already says twice.

### Traps

- **`iterLinkedPairs` short-circuits on `entries.length >= 2`**, and its own
  comment is the warning: *"Do not grow a branch off this count: which mates are
  on screen is the mate partition's question, and answering it from an entry
  count is what once dropped a split read's off-screen mate arc."* Step 1 is
  unaffected (two on-screen segments clear it); step 2's one-ended case is
  exactly the group this skips.
- **`enumerateBezierPairs`' `crossRegion` scope short-circuits on
  `laidOutPileupMap.size < 2`**, and that scope is *not* opt-in — it is what
  chain mode gets with curved connectors unticked. A one-ended hop in a
  single-region view is precisely `size < 2` with something to draw. Decide
  deliberately whether the new marks belong to the `all` scope only.
- **Cost.** The `crossRegion` short-circuit measures 0.0ms at 200k reads; the
  multi-region case that does enumerate is ~63–80ms, against the 587–1317ms
  `buildLaidOutChainMap` relayout beside it. Nobody has measured the
  single-region grouping this would newly pay for, so that is a measurement to
  take, not a number to carry over. Step 1 adds an SA parse per read group on top
  of it — `featurizeSA` on `readSuppAlignments`, which the arc path already pays
  and the overlay does not.
- **`segLocusKey` dedup is sound only because refNames are canonical**
  (`saSegments` normalizes; fetched entries already are) and because
  `readPositions` carries the read's *true* start rather than a region-clipped
  one. Anything reaching for a cheaper key re-opens both.
- **`unpairedReadChain` needs a `CanonicalRefName`** and the bezier path does not
  thread one today; `computePileupBezierArcsFromModel` would have to pass it, the
  way `derivativePathCandidates` does.
- **One seam, two outputs.** The live overlay and the SVG export both go through
  `computePileupBezierArcsFromModel` (`components/pileupBezierArcs.ts`), so a
  correct change lands in both — but check `PileupBezierArcsSvg.tsx` anyway,
  since a one-ended arc's bounding box is new and the export sizes its viewBox.
- **Legend.** `bezierConnectionLegendItems` builds one row per *color*. A dashed
  arc and a foot mark are new **marks**, not new colors — `connectionMark`
  already lets a row draw itself as the connector it names.

### How to see it

The COLO829 tumour ONT track in the `cancer_sv` demo
(`https://jbrowse.org/demos/cancer_sv/config.json`) is the case, and it is a
sharp one: chain 1 is a closed cycle chr3 → chr10 (199 bp) → chr12 (183 bp) →
chr3, and the two chr3 arms **overlap**, so a chr3-only view fetches both of them
and the overlay draws the false inversion above. Put chr3 alone on screen with
curved connectors on and compare against the arc band in the same display, which
draws nothing there with `drawLongRange` off and the three real hops with it on.
`website/scripts/specs/jbrowse-img.ts`'s `svReviewHalf` documents the same
configuration from the split view's side, where the dashed connectors are the
visible symptom.

---

## Gap 2: the shared `Chain` type lost its caller

The chain walk is still written three times:

| Where | Builder | Element | Input |
| --- | --- | --- | --- |
| `alignments/features/arcs/arcChains.ts` | `unpairedReadChain` → `unpairedChainArcs` | `SegAln` (`{refName, start, end, strand, clipAtStart, onScreen}`) | worker TypedArrays |
| `alignments/shared/readGroupConnections.ts` | `splitJunctions` in `readGroupConnections` | `ReadConnection<ReadEntry>` | worker TypedArrays |
| `breakpoint-split-view/…/featureMatching.ts` | `readChainSegments` → `markHiddenSegments` | `ChainSegment` (`{clip, refName, start, end}`) | `Feature` objects |

There is no `renderChainPaths` emitter over the shared `bezierConnectorPath`
either. But the extraction was proposed as the *enabling* refactor for the two
phases that shipped, and they shipped without it, so what is left is a refactor
for its own sake — and it is harder than the type table makes it look:

- The three chains **are not the same chain**. `unpairedReadChain` is the complete
  walk, on-screen entries merged with SA segments and deduped by locus
  (`segLocusKey`), on-screen record winning. `readChainSegments` is the
  SA-declared segments *only*, deduped by clip — its on-screen half arrives
  separately as `LayoutMatch`. `splitJunctions` is the on-screen segments only,
  which is [the bug above](#bug-the-overlay-draws-a-junction-that-is-not-there).
- They read **different input universes**: two walk worker TypedArrays through
  `MinEntry`, one walks `Feature` objects through `getTag`. The shared layer that
  could hold a common type is `@jbrowse/cigar-utils`, which already hosts what
  they genuinely share — `featurizeSAEntries`, `splitSA`, `getClip`,
  `connectionEndpointBps`.
- There is a **measured precedent going the other way**. The layer directly
  underneath — one shared `groupReadsByName` — was extracted, priced at 1.4–1.9x
  over 200k reads, and declined; see `reference/REJECTED_IDEAS.md`, "One shared
  `groupReadsByName`". The per-entry accessors are what did share, and that is
  the shape to aim at: share the layer with no per-read allocation in it.

The honest version is therefore narrow: **make `ChainSegment` and `SegAln` one
type** (the former is the latter minus `strand` and `onScreen`, with `clip`
renamed), lift it beside `featurizeSAEntries`, and leave the three walks alone.
That is a type-level change with no per-read cost. Anyone proposing more owes a
reason the full version lands differently from the `groupReadsByName`
measurement.

---

## Live finding

`PileupBezierOverlay`'s `onClick` always calls `model.selectFeatureById(arc.id1)`
(`components/PileupBezierOverlay.tsx`, line ~118), so the far endpoint of a
multi-hop arc cannot be reached by clicking it. `arcTooltip` directly above
already takes the whole arc for both ids, so the data is there; the click is what
never grew the second case. Whether it should toggle, pick the nearer endpoint,
or open both is a UI call, not a plumbing one.

## Closed — do not re-file

- **`arcIsVisible` culling a bowed curve by its endpoints' Y alone.** Fixed. It
  pads by `BEZIER_CONNECTOR_MAX_REACH_PX` and is now over-inclusive rather than
  lossy, with the asymmetry deliberate and commented.
- **A consensus fusion contig built in the browser.** Reverted in `e7b4f2b29b`;
  `SV_MULTIHOP.md` carries the three questions that killed it and generalizes
  them to anything new in this area.
