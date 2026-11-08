---
name: tutorials-genomes-portal-crosslinks
description: "Tutorials and genomes.jbrowse.org pages link each other wherever they share a genome or dataset. Waiting: v5 moving the multi-way tracks out of config-staging, links for pangenome_ecoli and ld_mosquitoes (anoGam3 matches AgamP4's arms), odp's renamed Dryad copies, a per-assembly tutorial list on the portal."
---

# Tutorials and genomes portal cross-links

Check this list before adding a tutorial on a hosted genome or a new portal
page, and update it as links land.

## The pattern

- Take each lane's assembly and gene track verbatim from its hub (`hub_parts`
  in `build_primate_orthologs.sh` and `build_hg38_liftover_multiway.sh`).
- A GenArk hub's `refNameColumnHeaderName: "ucsc"` makes UCSC names canonical,
  so a spec's `displayedRegionNames` says `chr12`, not the NCBI name.
- A hosted config must still boot on the host floor the portal serves
  (v4.3.0, the latest v5 tag and main).

## Open

- **Staging links**: `genomes_synteny.md` (hg38, mm39, the TNNT3
  conserved-gene-order page) and `pangenome_mouse.md` (mm39) link
  `staging.genomes.jbrowse.org` for the multi-way liftOver tracks. The pages
  are live on genomes.jbrowse.org, but only `config-staging.json` carries
  those tracks (checked 2026-11-08), so the links wait on jb2hubs promoting
  them into `config.json` when v5 ships. The repoint also covers
  `website/scripts/specs/synteny.ts`'s `liveUrl`, which feeds
  `figure-manifest.json` and `liveLinks.generated.ts`.
- **`pangenome_ecoli.md`** links nothing on the portal. The portal has no E.
  coli pangenome page, but it does have `/accession/<GCF>/` pages for three of
  the tutorial's five assemblies (GCF_000005845.2, GCF_000007445.1,
  GCF_000008865.2), not GCF_000026345.1 or GCF_002007705.1.
- **`syri_synteny.md`** links only the Arabidopsis pangenome page.
- **`odp_linkage_groups_synteny.md`**: EMU and BFL match portal assemblies, but
  the Dryad copies rename every sequence, so hub tracks would not line up; RES
  and BIN are different assemblies.
- **`ld_mosquitoes.md`** can link the portal's anoGam3. It reads AgamP4, and
  anoGam3 is AgamP3, but the five chromosome arms have the same lengths and
  sequence in both (spot-checked 2026-11-08). anoGam3's chromAlias maps `2L`
  to `chr2L`, so the tutorial's 2L coordinates open there. Only the gene
  models differ: AgamP4.12 against the hub's Ensembl and RefSeq genes.
- **A `/ucsc/[id]` page listing its tutorials**: derive the list from the
  `jbrowse.org/ucsc/<id>` config URLs the tutorials carry, published as an index
  jb2hubs fetches, not a hand-kept list.
- The GRCh38.p14 GenArk hub decision is jb2hubs'
  `ideas/waiting-on-a-call/genark-retire-grch38-p14-hub.md`.
