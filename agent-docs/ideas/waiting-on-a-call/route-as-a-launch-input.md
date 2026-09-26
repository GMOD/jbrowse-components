---
name: route-as-a-launch-input
description: Make the rearrangement a declarative launch input (`route`, an ordered oriented list of reference intervals with provenance) that any external caller, assembler or karyotype tool can target, so JBrowse renders the evidence around a route it did not compute. A route serialises to PAF, so the synteny view draws it as reference over derived allele with no new renderer; a simple `<DEL>`/`<DUP>`/`<INV>` record, a GATK-SV `<CPX>` record, a hifiasm contig, a LINX derivative chromosome and a gGnome walk all become producers of one object. Since ADR-137 removed the in-app picker, this is the only way JBrowse draws an allele.
---

# A route as a launch input

Agreed in principle with Colin 2026-09-02: "dedicated algorithms will likely
beat us any day of the week. de novo assemblies are also similarly much more
powerful." The direction is that JBrowse is controllable by external
automation to show an SV in the most useful way, not that it is an analysis
tool. The in-app derivative-allele picker was removed on 2026-09-18
([ADR-137](../../architecture-decision-records/adr-137-jbrowse-shows-sv-evidence-and-does-not-infer-alleles.md)),
and the offline script that built alleles went with
[ADR-140](../../architecture-decision-records/adr-140-sv-analysis-is-not-ours-to-ship.md),
so everything feeds in from outside.

## The object

A route is what every tool in the tutorial's "Related tools" section already
emits in some form. A hifiasm PAF holds it as one contig's alignment blocks,
LINX as a derivative chromosome, gGnome as a walk, GATK-SV as a complex
record. One shape, on a view in a session spec:

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
  inverted segment is entered at its high coordinate.
- `name`, `source` and `evidence` are provenance the picture prints and never
  reasons about. `source` is what makes the boundary in
  [reference/SV_MULTIHOP.md](../../reference/SV_MULTIHOP.md) §"The line this
  feature does not cross" visible on screen: it says who decided.
- Same key on a `LinearSyntenyView` draws the segments against a temporary
  derivative axis, on a `BreakpointSplitView` one panel per segment centred on
  its junction. The builders for both were deleted with the picker;
  `git log --diff-filter=D --oneline -- 'plugins/linear-comparative-view/src/LinearDerivativeVsRef/*'`
  finds the commit that holds them (`buildDerivativeVsRefSpec.ts`,
  `buildSplitViewFromPath.ts`), and a segment map drawn from a supplied route
  must print its `source`.

## The wire format is PAF, and the renderer already exists

A route converts to PAF losslessly. Each segment is one line, with the query
coordinate running along the derivative, the target the reference interval
and the strand the orientation. The synteny view draws that today; the `cancer_sv` tutorial's
der(3) figure is a real contig's PAF over the reference. So the synteny half
of the route key is the route-to-PAF rows over an axis the length of the
summed segments, and no new renderer. The split-view half maps each segment to
a panel and flips the panel of an inverted segment.

The picture states copy number and orientation without any further
computation. A segment the route visits twice draws two ribbons onto one
reference stretch, which is the "each molecule crosses this stretch twice"
callout of the der(3) figure. An inverted segment draws a crossed ribbon, which
[straighten-an-inversion-by-reversing-its-span](straighten-an-inversion-by-reversing-its-span.md)
untangles. A copy-number bigWig under both axes puts the caller's depth step
beside the ribbon that explains it.

The FASTA of the derivative is only needed to realign reads onto it, and that
stays with an assembler under ADR-140. Drawing ribbons needs no bases.

## What standard VCF carries

VCF 4.4 states the evidence well and states no walk. Two of its fields go
unread in the tree today.

- **A simple symbolic record needs no interpretation.** A `<DEL>` is `A C`, a
  `<DUP:TANDEM>` is `A B B C`, an `<INV>` is `A B′ C`. The converter is a
  table, nothing is inferred, and it gives every DEL, DUP and INV record a
  right-click entry "Open as reference vs derived allele".
- **GATK-SV writes its interpretation into a `<CPX>` record**, in `CPX_TYPE`
  and `CPX_INTERVALS`; it is the pipeline behind gnomAD-SV and the 1000
  Genomes 30x callset. The intervals list only the changed segments, one
  `SVTYPE_chr:start-end` each, so the walk order comes from `CPX_TYPE`, and
  the converter needs GATK-SV's published type table (`INVdup`, `dupINV`,
  `delINV`, `dDUP`, `piDUP_FR`, the `CTX_*` classes and the rest).
  1KGP's `HGSV_2721` (`INVdup`,
  `INV_chr1:39658980-39660275,DUP_chr1:39660047-39660275`) is the route
  `A C′ B′ C D`, and its two junctions are the LL and RR pairs the
  `sv_multisamples` tutorial's SV-channels figure shows. Neither field is a
  VCF standard, and nothing in the tree reads them.
- **`SVCLAIM`** marks a `<DEL>` or `<DUP>` as a depth claim, a junction
  claim or both. That is the standard's own separation of
  copy-number evidence from breakpoint evidence, and the variant reader ignores
  it, so a depth-only deletion draws like a junction-backed one. `EVENTTYPE`
  names an `EVENT`'s class and the breakend walk ignores it too.
- **A derived sequence has two standard spellings**: an explicit ALT string,
  or breakends whose mates point into a contig named by an `##assembly=`
  header (VCF §5.4.2, which `@gmod/vcf`'s `parseBreakend` already handles).
  Callers rarely write either, and the explicit form is impractical past a few
  kilobases.

VCF cannot state an ordered, oriented list of segments without a sequence.
That is the derivative chromosome, and it is the thing LINX, gGnome and
GATK-SV each invented a private format for. No INFO field of our own fills the
gap; the route is a session-spec object, and PAF is its file form.

A bare breakend set is the one producer that needs inference. The in-app walk
is that inference, labelled as one under ADR-140, so a route built from
breakends is offered only where the walk completes without an ambiguity stop,
and its `source` prints "walked from breakends".

## What already exists

- `InitState.loc` takes several regions "to frame something spread across
  loci", and its doc comment names the derivative allele as the example. A
  route is the typed, oriented version of that string, and `types.ts` is where
  it goes so `automating.md` picks it up through the include.
- The BND record's "follow further breakends" is a route walked out of a VCF.
  It guesses adjacency; with a Severus or LINX cluster id it would not have to.
- A contig's PAF rows, sorted by query offset, are a route; the synteny
  display already chains them for linked reads.
- [sv-review-portal](../ready/sv-review-portal.md) is a consumer — one card per route,
  whoever produced it, with the live link being this spec. A route with a
  sequence behind it (a contig BAM) takes that doc's read-vs-ref launch instead.
- Desktop's MCP surface is the agent-driven version of the same verb.

## The converters

Each is a table-to-table step. The VCF ones run in the variants plugin, since
the record is already parsed there; the file ones are scripts in `scripts/` or
shipped with the tool, and none belongs in core:

| Producer | Input | What a route is there |
| --- | --- | --- |
| any caller | a `<DEL>`, `<DUP>` or `<INV>` record | the record itself, by the table above |
| GATK-SV | a `<CPX>` record | `CPX_INTERVALS` laid out by `CPX_TYPE` |
| LINX | `*.linx.vis_segments.tsv` / derivative chromosome tables | one derivative chromosome's segment list, already ordered and oriented |
| gGnome | a walk | its ordered signed node list, mapped to intervals |
| hifiasm / Shasta / sawfish | contig-vs-reference PAF | one contig's rows sorted by query offset, strand from column 5 |
| Severus | cluster VCF | the breakends of one cluster id, in walk order where the walk is unambiguous |

## What this stops

Every in-app proposal that computes a route from reads, and ADR-137 says why:
reference-concatenated bases on the derivative panel, reads projected onto the
allele (reverted, `e7b4f2b29b`), deriving from partial spanners, and grouping
an in-CIGAR deletion as a junction. Each makes JBrowse a caller.

## Order of work

- The `route` key on `InitState` and the two view types. The synteny view
  draws route-to-PAF rows over a derivative axis; the split view opens one
  panel per segment and flips an inverted one. Tests are one spec round trip
  and one PAF round trip.
- The VCF converter and its right-click entry, simple symbolic records first,
  `<CPX>` second. `HGSV_2721` in the hosted 1KGP callset is the test record.
- The PAF converter, since it covers the assemblers and sawfish in one.
- Severus and LINX converters when a hosted dataset carries their output; HG008-T
  is the driver, as it is for the portal.

**Trigger:** the review portal, or the first external user with a caller's
output and no reads-in-view path to a picture. The 1KGP `<CPX>` record is a
producer already in hand, which is the case for starting with the VCF
converter now.
