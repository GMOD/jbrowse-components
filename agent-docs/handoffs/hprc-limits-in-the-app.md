---
name: hprc-limits-in-the-app
description: "Turning the HPRC tutorials' limits sections into things the app shows (Colin, 2026-11-01: \"in case we are able to fix or at least improve on them\"). Landed: lane labels with form counts and one-structure launch notes on the genomes.jbrowse.org HPRC page (jb2hubs b7522325fec3, on staging), and a named foot row for a chosen lane the window places nothing in (90a8a64091). Open: an end marker where a lane stops, the VCF parents vcfbub dropped, an antibody-locus caveat, and one unverified sentence in part 2's limits. Format 6 departures and the 'deletion' rename belong to gfa-to-tabix's departures thread."
---

# The HPRC limits, shown in the app

`website/docs/tutorials/pangenome_hprc.md#limits` and
`pangenome_hprc_haplotypes.md#limits` list what the graph, the VCF and the lanes
leave out. A 2026-11-01 review traced each limit to its cause. Inherent to the
data, and left to the docs: Minigraph-Cactus merging near-identical copies
(SMN, SRGAP2, DEFB keep `graphCollapsed` in jb2hubs `pangenomeLoci.ts`),
haplotypes the graph clips, lymphoblastoid V(D)J deletions at IGH/IGK/IGL, and
differences under 50 bp inside a structural form.

## Landed

- **Lane labels count the form** (jb2hubs `pangenomePanels.ts` `laneAlike`,
  `pangenomeLinks.ts` `laneLabel`): "HG00099.1 · 1 of 140 alike".
- **One-structure launch notes** (jb2hubs `regionLaunches`' `oneStructure`):
  a typed window whose live reading finds no form says so on Graph and
  Variants; the links stay, since a reading can fall back to the sidecar.
- **A chosen lane placing nothing is a foot row** headed "no alignment in this
  window" (`MultiWaySyntenyDisplay/model.ts` `unalignedChosenLanes`,
  `placelessOf`). Only `rows.kept` counts as a choice; the row waits for the
  held fetch to land and answer the lane. Reaches the HPRC launches when the
  hosted main build picks it up.

## Open

- **End marker where a lane stops partway.** graph-walks already knows why each
  stretch ends: `WalkStop` is `break` (with the bp the graph lacks) or `end`
  (`walkRows.ts:72-76` in the graph plugin's graph-walks). The lanes adapter
  (`WalkTabixSyntenyAdapter.ts`) drops `before`/`after` except at crossings.
  Sketch: an end record per lane, drawn as a tick in the multi-way display
  with "graph stops; N kb unaligned" or "contig ends". Format 6's one-ended
  departures and `missingBp` feed it directly, so build it after format 6.
  Moderate: plugin plus a new mark here.
- **The VCF parents vcfbub dropped.** The release removed every site with an
  allele over 100 kb and kept the sites nested in it (the vcfbub section of
  `jb2hubs/agent-docs/reference/PANGENOME_PORTAL.md`), so the
  Variants launch cannot show the UGT2B17 deletion. The release's
  `raw.vcf.gz` holds the parents. Sketch: extract them, write symbolic
  `<DEL>`/`<INS>` alleles, host them as a second callset row. Check the record
  size before choosing: written with sequence, one allele is a 100 kb line.
  Moderate, jb2hubs hosting.
- **Antibody-locus caveat.** A `vdjDeletions`-style flag on the IGH, IGK and
  IGL loci in `pangenomeLoci.ts`, read by the region box and the lane headers,
  so the cell-line caveat appears where it applies. Small, jb2hubs; few
  readers land there.
- **Part 2's first-or-last-chunk sentence is unverified.** "A window in the
  deletion's first or last chunk shows no row for that haplotype" may hold only
  for deletions over about 256 kb: graph-walks reads `FOLLOW_CHUNKS` (4) chunks
  onward (`walkReader.ts:31,469`) and turns a direct jump into a skip
  (`walkRows.ts:630-631`). Inferred, not driven. Open one deletion under and
  one over 256 kb at a window in its first chunk, then fix the sentence.

## Owned elsewhere

- **Format 6 departures**, which lift the 64 kb chunk and the 2 Mb cap behind
  part 2's deletion-row limit: gfa-to-tabix ADR 0009 and its
  `docs/handoff/2026-10-31-departures.md`. Step 1 of that handoff, dropping the
  word "deletion" from jumps, needs no format change; the lane header
  (`laneHeader.ts`) and the plugin's `walkLanes.ts` record type are done.
