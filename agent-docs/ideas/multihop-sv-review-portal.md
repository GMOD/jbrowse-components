---
name: multihop-sv-review-portal
description: Plan for a static review portal over every junction chain `sv_multihop.py chains` finds in a somatic SV callset, one card per chain with the reads at each locus, the derived allele where `derive` succeeds, a verdict and a live link. HG008-T's V0.5 benchmark carries EVENT/EVENTTYPE, which is a truth set for the chain finder itself.
---

# Multi-hop SV review portal

Agreed with Colin 2026-08-27; parked here because v5.0.0 does not turn on it.
`cancer_sv` reviews one chain by hand; `sv_callset_review` renders every
junction of a callset but two panels at a time and with no chain grouping.
This is the two joined: scale `cancer_sv`'s figure to every chain in a
callset, in the shape of
[gene-review-portal](https://github.com/cmdcolin/gene-review-portal).

## What a card is

One chain from `sv_multihop.py chains`:

- **Reference row**: tumour above normal, one panel per locus the chain
  visits, split alignments only, chain layout, curved connectors, soft
  clipping on. The settings are `website/scripts/specs/cancer_sv.ts` lines
  380-400 (`filterBy: {split:'only'}`, `linkedReads:'normal'`,
  `showBezierConnections: true`, `forceLoad: true`, `featureHeight` 2-4).
- **Derivative row**, when `derive` succeeds: the allele against its source
  loci, segments BED and realigned reads, which is `sv_review_derivative` in
  `website/scripts/specs/jbrowse-img.ts` with the chain's ids.
- **Facts the picture cannot show**: hops, chromosomes, spanning-read count
  from `derive`, reads in the normal with a chain at these loci, and for a
  benchmarked callset the `EVENT`/`EVENTTYPE` the chain matched.
- **Verdict**: confirmed / needs a look / artefact, kept in the browser and
  exported as TSV, the way gene-review-portal's `app.jsx` does it. Nothing
  writes a FILTER or a genotype: `reference/SV_MULTIHOP.md` §"the line this
  feature area does not cross" says JBrowse ranks what the reads say and does
  not decide what is true.
- **Live link**: the breakpoint split view spec, and the synteny spec
  `derive --jbrowse-out` already prints.

## Test drivers

**HG008-T (CGIAB), the primary driver, because it carries the answer.** The
V0.5 draft benchmark
(`GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz`, 210 records)
tags records with `EVENT` and `EVENTTYPE`. Checked 2026-08-27: 15 clusters of
two or more records, among them `cluster_3` and `cluster_5` (CHROMOPLEXY),
`cluster_1`, `cluster_11`, `cluster_14` (TRA:BALANCED), `cluster_10`,
`cluster_15` (BND), `cluster_6` (DEL, 10 records), and five INV clusters. So:

- `chains` has a truth set. A chain the finder emits either matches one
  `EVENT` (a hit), spans two (over-merged: `--max-segment` too wide), splits
  one (under-merged), or matches none (a chain the benchmark did not call,
  worth a card of its own).
- `EVENTTYPE` is the card's class label, free.
- `cluster_3` is already characterised: 65 spanning reads on the top route,
  matched normal 0 with an SA (`SV_MULTIHOP.md` §"HG008-T").
- Reads: PacBio Revio 116x tumour / 35x normal at
  `ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/`,
  range requests against the 118 GB BAM, seconds per junction
  (`reference/DEMO_DATASETS.md`). The `demos/cgiab` slice covers only the
  tutorial's loci and renders empty pileups elsewhere, so the portal points
  at NCBI.
- Four more callsets on the same reads (Severus, minda, DRAGEN, NYGC BEDPE)
  give the "callers disagree" cards: run `chains` per caller and show which
  callers' junctions each chain is built from.

**COLO829 (ONT), the second driver, because everything is hosted and
`derive` is proven on it.** 100 junctions, 4 chains of ≥3 hops at the
defaults, chain 1 derives in 9 s against the hosted CRAM and reproduces the
committed PAF byte for byte. The other three chains have never been run and
are the first thing this pipeline will say something new about. No
`EVENT` tags, so this is the unlabelled case.

**The matched normal is the built-in negative.** Every card renders the
normal under the tumour, and the batch study in `SV_MULTIHOP.md` §"Batch
study" is the number to keep in view: the normal proposes a route at 40 % of
COLO829's windows and 4 % of HG008-T's while recovering 0 somatic junctions.
A card whose normal panel also chains is the card the reviewer has to look
at.

**Not drivers.** HG002 Tier1 is germline, hg19, and needs no chaining. K562
has no usable hg38 WGS (`ideas/cancer-sv-datasets-unshot.md`). HCC1395
(SEQC2, Revio HiFi at `downloads.pacbcloud.com/public/revio/2023Q2/HCC1395/`)
is the third driver once the first two work: six CNV callers to adjudicate.

## Pieces

Python finds chains and rebuilds alleles; Node renders and builds the page.
That boundary already exists and the plan keeps it.

1. **`sv_multihop.py chains --json out.json`.** Per chain: `id`, `hops`,
   `junctions` with the VCF `ID`s `parse_junctions` currently drops, the
   `--loci` string, `chromosomes`, and the `EVENT`/`EVENTTYPE` values of its
   junctions when the VCF carries them. The `--loci` line is what
   `build_cancer_sv_demo.sh` hand-copies today.
2. **`sv_multihop.py review`**: iterates the JSON, runs `derive` per chain
   in-process with the chain's loci, resumable (skip when
   `<out>.derive.json` exists), failure a recorded state rather than an
   abort. `derive` gains that `.derive.json` (contig, files, spanning-read
   count, junction offsets) since today it only prints. A merge step joins
   the per-chain `jbrowse_config()` outputs into one `config.json` (ids are
   already namespaced by `track_ids`). Emits `review.json`: chain facts,
   derive status, and the two session specs per card, encoded with the same
   `spec-` scheme `derive` prints.
3. **`jb2export batch --loci rows.tsv`**: `BedpeRecord` has `refName1/2` and
   nothing else, so today a chain of three loci is not a row. Generalise to
   `loci: Locus[]`; `recordArgv` already maps loci onto repeated `--loc`,
   `outputName` joins them. `jb2export breakpoint` already takes N `--loc`
   and the `split:only linkedReads:normal force:true` modifiers, so the
   reference row renders server-side with no browser. Derivative row is the
   existing `sv_review_derivative` invocation with the chain's ids.
4. **`make-sv-portal.mjs`** beside `make-portal.mjs`, sharing `lib/`:
   `capture.mjs` (opt-in, `--renderer capture`), `page.mjs`, `template.html`,
   `app.jsx` with the card generalised to `{id, title, images[], links,
   meta}` and classes `EVENTTYPE | n-hop | derive-failed`. The memory note
   `gene-review-portal-extraction` says the portal code lives in two trees
   until jbrowse-capture is published; this adds to both.
5. **Tutorial and demo**: a "chains as a review queue" section on
   `sv_callset_review`, one `cliSpec` per driver in
   `website/scripts/specs/jbrowse-img.ts`, `build_cancer_sv_demo.sh` looping
   over `chains.json` instead of the hand-typed `--loci`, the HG008 portal
   deployed with `scripts/deploy-demo.sh`, and
   `check_sv_multihop_pipeline.py` extended to run `review` over its
   synthetic allele.

Order: 1 → 3 → 2 → 4 → 5. 1 and 3 are each a day and unblock a first
portal with no derivative row; 2 is 1.5 d; 4 is 2 d; 5 is 1-2 d.

## Risks

- **`derive` on every chain.** 9 s per chain on COLO829's hosted CRAM, but a
  chain needs reads touching all its loci (`touches_all`), so at
  `--min-hops 2` over 100 junctions many chains fail or run for minutes on
  a slow mirror. Resumable and per-chain failure is the whole of the answer;
  the first portal ships with the reference row alone.
- **Locus order.** `chain_loci` sorts lexically; the read order is what
  `derive` learns. Reference panels take lexical order, the derivative row
  carries the true one.
- **Byte gate.** Every reference panel needs `force:true` (img) or
  `forceLoad: true` (app) at 116x-200x; one panel per locus at a fixed flank,
  never one window per chain. `ideas/per-region-banner-for-a-mixed-region-set.md`
  is the open bug a mixed-size region set hits.
- **Capture readiness.** Software-rasterised Chromium over 3-5 panels of
  deep long reads with bezier connectors is slow and the portal already
  retries twice; that is why `jb2export` is the default renderer.
- **One config, N assemblies.** Each derived allele is its own assembly with
  its own BAM; the portal is self-contained (`--with-app`, `serveStatic`),
  since `demos/cancer_sv/config.json` carries one.
- **Over-merging is a real result, not noise.** With `EVENT` as truth,
  `--max-segment` gets a measured setting for the first time; report the
  hit / over-merged / under-merged / unmatched counts per driver in
  `SV_MULTIHOP.md` alongside the batch study.

## Decisions for Colin

- Where the Node half lives: in `gene-review-portal` beside `make-portal.mjs`
  (proposed), or an in-tree `demo/` package.
- Whether the first cut is HG008 only (has truth, needs NCBI range requests)
  or COLO829 only (all hosted, no truth). Proposed: HG008 first, COLO829 as
  the second `cliSpec` the same week.
- Whether a "Draw as: linear genome view" option in the derivative dialog
  (the multi-region LGV `k562_fusions` hand-builds) ships first, since the
  card's reference row is that view.
