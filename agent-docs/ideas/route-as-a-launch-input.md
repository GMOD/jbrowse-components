---
name: route-as-a-launch-input
description: Make the rearrangement a declarative launch input (`route`, an ordered oriented list of reference intervals with provenance) that any external caller, assembler or karyotype tool can target, so JBrowse renders the evidence around a route it did not compute — the picker, `derive --jbrowse-out`, a hifiasm contig, a LINX derivative chromosome and a gGnome walk all become producers of one object, and the in-app analysis stops growing.
---

# A route as a launch input

Agreed in principle with Colin 2026-09-02: "dedicated algorithms will likely
beat us any day of the week. de novo assemblies are also similarly much more
powerful." The direction is that JBrowse is controllable by external
automation to show an SV in the most useful way, not that it is an analysis
tool. The derivative-allele picker stays as the no-pipeline path and as the
dissent view; everything else feeds in from outside.

## The object

A route is what every tool in the tutorial's "Related tools" section already
emits in some form: the picker's `DerivativeCandidate.segments`, `derive`'s
`vs_reference.paf`, one contig's alignment blocks in a hifiasm PAF, a LINX
derivative chromosome, a gGnome walk, a Severus cluster. One shape, on a view
in a session spec:

```json
{
  "type": "BreakpointSplitView",
  "route": {
    "segments": [
      { "loc": "chr3:25,326,821-25,359,568", "strand": 1 },
      { "loc": "chr10:58,717,463-58,717,662", "strand": 1 },
      { "loc": "chr12:72,273,111-72,273,294", "strand": -1 },
      { "loc": "chr3:25,352,683-25,359,111", "strand": -1 }
    ],
    "name": "der(3)",
    "source": "severus cluster_3",
    "evidence": { "reads": 28 }
  },
  "tracks": ["COLO829_tumor", "COLO829_normal"]
}
```

- `segments` is ordered along the derivative and each one is oriented; an
  inverted segment is entered at its high coordinate
  (`segmentEntryBp`/`segmentExitBp`, and the picker's own rule).
- `name`, `source` and `evidence` are provenance the picture prints and never
  reasons about. `source` is what makes the boundary in
  [reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md) §"The line this
  feature does not cross" visible on screen: it says who decided.
- Same key on a `LinearSyntenyView` draws the segment map against a temporary
  derivative axis (`buildDerivativeVsRefSpec`), on a `BreakpointSplitView` one
  panel per segment centred on its junction (`buildSplitViewFromPath`). Both
  builders exist; today only the picker can call them.

## What already exists

- `InitState.loc` takes several regions "to frame something spread across
  loci", and its doc comment names the derivative allele as the example. A
  route is the typed, oriented version of that string, and `types.ts` is where
  it goes so `automating.md` picks it up through the include.
- The BND record's "follow further breakends" is a route walked out of a VCF.
  It guesses adjacency; with a Severus or LINX cluster id it would not have to.
- [derivative-allele-from-assembly-contigs](derivative-allele-from-assembly-contigs.md)
  already feeds contig blocks through the picker's chain code. With a route
  input the contig does not need the picker at all: a PAF row set is a route.
- [multihop-sv-review-portal](multihop-sv-review-portal.md) is a consumer — one
  card per route, whoever produced it, with the live link being this spec.
- Desktop's MCP surface is the agent-driven version of the same verb.
- `derive --jbrowse-out` prints a session URL today. It would print a route,
  and its custom config goes away.

## The converters

Each is a table-to-table script in `scripts/` or shipped with the tool, the
way `sv_multihop.py` is, and none belongs in core:

| Producer | Input | What a route is there |
| --- | --- | --- |
| Severus | cluster VCF | the breakends of one cluster id, ordered by the graph |
| LINX | `*.linx.vis_segments.tsv` / derivative chromosome tables | one derivative chromosome's segment list, already ordered and oriented |
| gGnome | a walk | its ordered signed node list, mapped to intervals |
| hifiasm / Shasta / sawfish | contig-vs-reference PAF | one contig's rows sorted by query offset, strand from column 5 |
| `sv_multihop.py derive` | `vs_reference.paf` | the same as above; it is already a PAF |
| the picker | `DerivativeCandidate` | `segments` as-is, `source: "reads in view"` |

## What this stops

Every in-app proposal that computes a route from reads beyond the current
picker: reference-concatenated bases on the derivative panel
(`REJECTED_IDEAS.md`), reads projected onto the allele (reverted, `e7b4f2b29b`),
[derive-from-partial-spanners](derive-from-partial-spanners.md), the in-CIGAR
deletion grouping in
[chain-in-read-deletions-not-only-sa-segments](chain-in-read-deletions-not-only-sa-segments.md).
Each moves the picker toward being a caller; the route input moves it the
other way. They stay parked with their triggers; this is the reason not to
pull them.

## Order of work

- The `route` key on `InitState` and the two view types, resolving through the
  existing builders. Tests are the builders' own, plus one spec round trip.
- `derive --jbrowse-out` emits it; the tutorial's session fence becomes a route.
- The PAF converter, since it covers derive, the assemblers and sawfish in one.
- Severus and LINX converters when a hosted dataset carries their output; HG008-T
  is the driver, as it is for the portal.

**Trigger:** the review portal, or the first external user with a caller's
output and no reads-in-view path to a picture.
