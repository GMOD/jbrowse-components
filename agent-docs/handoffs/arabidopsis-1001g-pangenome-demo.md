---
name: arabidopsis-1001g-pangenome-demo
description: The 1001G+ Arabidopsis demo (26 accessions vs TAIR10) as of 2026-09-24. SyRI lanes and a minigraph graph built on ada; the SyRI-only config is on jbrowse.org; a lane-order graph rebuild was running; the steps left to deploy the graph and add the dataset to jb2hubs. Read before touching demos/arabidopsis_pangenome or its build script.
---

# 1001G+ Arabidopsis pangenome demo: finish the graph half, deploy, add to jb2hubs

Branch `1001g-syri-demo` (worktree `.claude/worktrees/1001g-syri-demo`), rebased
onto main after the attributeColumns commit landed there as 98f939e486.

The graph finished before ada went down (minigraph 10:16, projections 12:36 ada
time); the projections are staged in `~/tutorial_spikes/1001g/host/`. The
SyRI-only config and README are on jbrowse.org; the graph files are not.

Three things block redeploying:

- **The default session drops three of its four tracks on `code/jb2/main`.**
  A spec-form `defaultSession` naming LinearWiggleDisplay,
  LinearMultiRowFeatureDisplay or MultiWaySyntenyDisplay gets them pruned by
  `pruneUnbuildableNodes.ts` as "pending plugins", because their lazy state
  models have not loaded (`isStateModelLoaded === false`). It reproduces
  same-origin on ada and without the GraphGenomeView plugin; the same session
  passed as `session=spec-…` in the URL renders. Core bug, not this config.
  Fixed by 250d44b8b5 (the prune leaves a track recipe for the launcher);
  the demo needs it pushed and `code/jb2/main` redeployed.
- **The hosted graph was built in `graph_order.txt` order** (TAIR10, Col-0.6909,
  KBS-Mac-74, Fly2-2, Nyl-7, T690, TRA-01, Sq-1, HSm, …), not the ROWS lane
  order the committed script uses, so the script does not reproduce it.
- **minigraph holds no knob-sized bubble.** The largest bubble in
  Chr4:1.5-2.9 Mb spans 77 kb; the largest inversion bubble genome-wide is
  Chr4:4,205,393-4,794,539 (589 kb). Only the SyRI track shows the knob.

gfatools stat: 190894 segments, 268283 links, max rank 26, total segment
length 210,754,337, rank-0 length 119,146,348. Versions: minigraph 0.21-r606
(`-t 12`), gfatools 0.5-r296.

Capturing: ada's `~/1001g/www/app-main` is `s3://jbrowse.org/code/jb2/main`
copied as-is, and `products/jbrowse-capture/esm-1001g` on ada's checkout is the
laptop's current jb2capture (ada's own has no `--spec`). Chrome blocks
jbrowse.org from fetching a localhost config, so capture same-origin on ada.

## What exists

- `scripts/build_arabidopsis_pangenome.sh` + `scripts/arabidopsis_pangenome_config.py`
  (committed): 26 1001G+ Phase 1 accessions vs TAIR10, SyRI lanes as one
  `MultiGenomePAFAdapter` PAF plus a regions BED with one row per accession,
  Fst and OmegaPlus bigWigs, the EVA-hosted 1001 Genomes SNP and INSSV VCFs,
  every accession's portal-hosted genes, TEs, methylation and ChIP, and a
  minigraph graph with the five mouse-style projections plus
  `build_minigraph_paths.sh` carriage rows. `--base-url` writes the absolute
  copy jb2hubs hosts.
- `demos/arabidopsis_pangenome/README.txt` (uncommitted): provenance, tool
  versions, the per-accession SyRI table and the knob-inversion finding.
  The SyRI-only deploy dropped the graph's `gfatools stat` block and marks the graph "not uploaded yet"; restore both once the graph ships.
- The actual run lives on `ssh ada`, `~/1001g/`: all 26 `TAIR10_<name>.{paf,regions.bed,syri.out}`,
  `<name>.{chrom.sizes,aliases.txt}`, `graph/` with the 27 PanSN FASTAs,
  `build_graph.sh` (minigraph -cxggs, was running at 07:31 ada time, about 3
  min per genome) and `project_graph.sh` queued behind it, which writes
  `graph/arabidopsis-tair10-minigraph.*`. Logs `build_graph.log`,
  `project_graph.log`. A static server on ada port 8790 serves `~/1001g/www`
  (`app/` = primary's 5.0.0-beta.9 web build, `data/` = `~/1001g/host`), and
  `node ~/src/jbrowse-components/products/jbrowse-capture/esm/bin.js --instance
  http://localhost:8790/app/ --config http://localhost:8790/data/config.json
  --session <spec.json>` captures from it.
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

1. On ada, when `project_graph.log` says `projections done`: rsync
   `graph/arabidopsis-tair10-minigraph.*` into `~/tutorial_spikes/1001g/host/`,
   rerun `stage.sh`, validate (`node --experimental-strip-types
   products/jbrowse-cli/src/bin.ts validate deploy/config.json`), put
   `gfatools stat` into the README, and capture a GraphGenomeView frame of
   the inversion.
2. `cp deploy/config.json demos/arabidopsis_pangenome/config.json`, commit
   README and config, then `scripts/deploy-demo.sh` the config and README, and
   every data file in `deploy/` with `DEPLOY_DEMO_ALLOW_UNTRACKED=1` to
   `arabidopsis_pangenome/<file>` (about 75 objects). The build script is
   committed, which HOSTING.md requires before the upload.
3. Share URL once 5dc19f4ae2 is on `code/jb2/main`:
   `https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/arabidopsis_pangenome/config.json`.
   Until then the `syri` ribbon colouring is grey; `ribbonColor.field: strand`
   is the fallback that draws on today's builds.
4. jb2hubs (`~/src/jb2hubs`, another repo; this worktree session cannot run
   git there): `website/pangenome-config/arabidopsis-tair10.json` =
   `deploy/config.jb2hubs.json`; a `DATASETS.arabidopsis` entry in
   `website/generatePangenomeLoci.ts` (`genome: 'GCF_000001735.4'`,
   `geneTrack: 'ncbiRefSeqCurated'`, and it needs a Chr→NC_ alias map because
   the tier says `Chr4` and the UCSC API wants `NC_003075.7`); an
   `ARABIDOPSIS_DATASET` in `website/src/components/pangenomeDataset.ts`
   (reference `GCF_000001735.4` via `genarkConfigPath`, taxonId 3702, gene
   track `GCF_000001735.4-ncbiRefSeqCurated`, chromosomes Chr1-5 with lengths
   30427671 19698289 23459830 18585056 26975502, filePrefix
   `https://jbrowse.org/demos/arabidopsis_pangenome/arabidopsis-tair10-minigraph`,
   measured sizes, links to 1001genomes.org and the README), added to
   `PANGENOME_DATASETS`; then `pnpm check-pangenome-assets`.
