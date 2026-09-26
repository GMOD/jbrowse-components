---
name: arabidopsis-1001g-pangenome-demo
description: The 1001G+ Arabidopsis demo (26 accessions vs TAIR10) is live on jbrowse.org with SyRI lanes and the lane-order minigraph graph (2026-09-25). Left - upload the jb2hubs graph config, push and deploy jb2hubs. Read before touching demos/arabidopsis_pangenome or its build script.
---

# 1001G+ Arabidopsis pangenome demo: deploy the jb2hubs dataset

Live since 2026-09-25:
`https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/arabidopsis_pangenome/config.json`.
The default session draws genes, Fst, the SyRI rows and the graph's allele
rows over the Chr4 knob. The hosted graph is the lane-order rebuild (ada
`~/1001g/graph/`, minigraph 15:59-17:48, projections 20:11 on 2026-09-24),
which is the order `scripts/build_arabidopsis_pangenome.sh` folds genomes in,
so the script reproduces it. The first, graph_order.txt build is kept in
`graph/order_v1/` on ada. The uncompressed `.rgfa` was not uploaded;
`.rgfa.gz` is the download.

minigraph holds no knob-sized bubble (largest inside Chr4:1.6-2.8 Mb: 72 kb of
TAIR10), so only the SyRI track shows the knob; the README says so. A
GraphGenomeView over Chr4:1.5-2.9 Mb loads the tier (97 nodes, 96 edges, a
plain chain) but jb2capture never sees it settle, so there is no graph frame.

Capturing on ada: `node` is not on a non-interactive PATH; prefix
`PATH=$HOME/.local/share/fnm/node-versions/v24.2.0/installation/bin:$PATH`.
`~/1001g/www/app-main2` is today's `code/jb2/main` (`app-main` predates the
spec-session prune fix and drops default-session tracks).

## What exists

- `scripts/build_arabidopsis_pangenome.sh` + `scripts/arabidopsis_pangenome_config.py`
  (committed): 26 1001G+ Phase 1 accessions vs TAIR10, SyRI lanes as one
  `MultiGenomePAFAdapter` PAF plus a regions BED with one row per accession,
  Fst and OmegaPlus bigWigs, the EVA-hosted 1001 Genomes SNP and INSSV VCFs,
  every accession's portal-hosted genes, TEs, methylation and ChIP, and a
  minigraph graph with the five mouse-style projections plus
  `build_minigraph_paths.sh` carriage rows. `--base-url` writes the absolute
  copy jb2hubs hosts.
- `demos/arabidopsis_pangenome/{config.json,README.txt}`, deployed as-is:
  provenance, tool versions, `gfatools stat`, the per-accession SyRI table
  and the knob finding.
- The run lives on `ssh ada`, `~/1001g/`: all 26
  `TAIR10_<name>.{paf,regions.bed,syri.out}`, `<name>.{chrom.sizes,aliases.txt}`,
  `graph/` with the 27 PanSN FASTAs and the projections, logs
  `rebuild_lane.log` and `graph/minigraph.log`. `node serve.mjs www 8790`
  serves `~/1001g/www` (`data/` = `~/1001g/host`, which holds the deployed
  files).
- Laptop staging: `~/tutorial_spikes/1001g/` (`stage.sh` assembles `deploy/`
  and runs the repo generator; `cap2.png` is the 26-lane frame).

## Findings worth keeping

- 24 of 26 accessions carry the chromosome 4 knob inversion against TAIR10;
  nine at exactly Chr4:1,612,605-2,782,621 (1,170,016 bp), the Col-0 vs Ler
  interval. Only Col-0's own assembly (6909) and KBS-Mac-74 have TAIR10's
  arrangement. Col-0.6909 vs TAIR10 is the control: 13 syntenic regions, 5
  inversions totalling 35 kb.
- A session spec naming the assembly `GCF_000001735.4` opens the `TAIR10`
  assembly through its `aliases`, but jb2capture's census then fails wanting
  the literal name. jb2hubs launches pass `dataset.reference.assembly`, so
  check `checkPangenomeLaunches.mjs` before choosing the reference name there.
- `jbrowse.org/hubs/genark/.../GCF_000001735.4/accessions.tsv.gz`, which the
  GenArk config names as `samplesTsvLocation`, 404s.
- Lanes draw gene annotation only (`laneAnnotation.ts` ranks GFF3, GTF, BED);
  the accessions' methylation bigWigs cannot ride in a lane.

## To finish

jb2hubs has the dataset on its local main, not pushed. Its reference is GenArk's
`GCF_000001735.4`, with `assemblyNameToPanSN` mapping it onto the graph's
TAIR10 paths (d413d73f8c8). Its graph config carries the demo's
`syri_regions.bed.gz` as a 26-row track, which every locus launch opens under
the lanes (f0bec307bd8), since the graph shows nothing of the chromosome 4
inversion, and `tutorialUrl` is the SyRI tutorial, whose last section opens
this demo. Left:

- `~/src/jb2hubs/website/pangenome-config/upload.sh`: `check-pangenome-assets` reports the
  served `arabidopsis-tair10/config.json` differs from the tree.
- Push jb2hubs and deploy its website.
- Redeploy `demos/arabidopsis_pangenome/config.json` with
  `scripts/deploy-demo.sh`: the generator now puts the regions track's key in
  plotsr's order, which the hosted copy predates.
