---
name: figures-blocked-on-data
description: Figures nobody can shoot until someone builds, hosts or pays for the data behind them — the junction BED the RNA-seq tutorial section names and nothing hosts, four parked on a cost or a call Colin has not made (wheat Compara, the ortholog palette, a per-level dotplot scale, the wolf-ancestry sweep), and the cancer SV datasets worth shooting plus the three dead ends recorded so nobody re-checks them.
---

# Figures blocked on data, a cost or a call

None of these is a capture problem. Each needs a `scripts/build_*.sh` run, a
`scripts/deploy-demo.sh` upload (never `aws s3 cp`, which does no versioning), a
cost someone has agreed to pay, or a decision that is not the implementer's.
Once the data is hosted the figure itself is ordinary: a spec in
`website/scripts/specs/`, `pnpm figures:push --filter`, commit `figures.lock`.

Pangenome graph figures have their own ranked queue in
[pangenome-figures-unshot.md](pangenome-figures-unshot.md), and the C-GIAB
tutorial's remaining sections are in
[cgiab-tutorial-followups.md](cgiab-tutorial-followups.md).

## The junction-BED tutorial section has no figure

`bc04116182` added the RNA-seq tutorial section on loading junction files as BED
arcs and left it with prose only. Every other section on that page carries a
still, so the one route a reader is most likely to get wrong — which column the
score comes from, and what the arcs look like once they land — is the one with
nothing to compare against.

**The blocker is data, not capture.** The section names a junction BED that is
not hosted anywhere, so a spec pointing at it has nothing to fetch. That means a
`scripts/build_*.sh` producing the BED from a public RNA-seq alignment, then
`scripts/deploy-demo.sh` — never `aws s3 cp`, which does no versioning. Neither
has been run.

Once it is hosted the figure is ordinary: a spec in `website/scripts/specs/`,
`pnpm figures:push --filter`, commit `figures.lock`.

## Parked on a cost or a decision

Four items surfaced and then left, each because the next move is expensive or
is not the implementer's to make. The first three came out of the screenshot
review, the last out of the 2026-08 tutorial-focus pass.

- **Wheat homoeologs are Compara-derived and Colin does not want that.**
  `scripts/build_wheat_homoeologs.sh` pulls
  `Compara.*.protein_default.homologies.tsv.gz`, where
  `scripts/build_oat_homoeologs.sh` computes its own anchors (DIAMOND
  self-alignment + jcvi + `kaks_from_pairs.py`) and so depends on no external
  ortholog table. Rebuilding wheat the oat way means a *hexaploid* DIAMOND
  self-alignment and a demo-bucket upload. That cost has never been measured,
  which is the first move.
- **`sv_synteny/ortholog_colors` wants a curated palette**, which means changing
  core `randomColor` (`packages/core/src/util/color/`, exposed as a jexl
  function) rather than the spec. Awaiting the word, because that function's
  output is baked into every config using it.
- **"Consistent genomic scale per level" across a dotplot set** — the obvious
  lever doesn't work. `squareView()` averages `bpPerPx`, so on the wheat/oat
  pair the hexaploid overflows while the diploid leaves whitespace, and
  `bpPerPx` is not settable from a session spec at all (an `InitState` carries
  `loc`/`grow`/`displayedRegionNames` only). Either the spec layer grows a way
  to state a scale, or the figures accept the mismatch.
- **The wolf-ancestry frequency sweep across all autosomes**, which would let
  the local-ancestry tutorial quote genome-wide fractions instead of chr1-only
  ones. Run `build_dog10k_wolfdog_ancestry.sh` over chr1..chr38 and summarize
  wolf ancestry per position across the eight wolfdogs as a quantitative track.
  Cost re-measured 2026-08-04 after the target set grew from 11 animals to 243:
  chr1 is ~15 minutes (4 of remote slicing for 591 samples, the rest FLARE at 16
  threads), and chr1 is ~6% of the autosomes, so the sweep is 4-5 hours rather
  than the ~3.5 the 11-animal run implied. Compelling if a depleted region lands
  on something known — but with eight animals the noise is real: describe it, do
  not call it selection.

## Cancer SV datasets not yet shot

Lifted from the `cancer_sv` build; the tool and the verified COLO829/K562 facts
are in [reference/SV_MULTIHOP.md](../reference/SV_MULTIHOP.md).

- **HCC1395 multi-caller copy number.** SEQC2 publishes CNV output from six
  callers plus SNP arrays on one tumour, all hg38, and PacBio Revio HiFi
  tumour/normal BAMs are public at
  `downloads.pacbcloud.com/public/revio/2023Q2/HCC1395/`. "Callers disagree,
  adjudicate them against the reads" is a distinct tutorial from the existing
  C-GIAB one.
- **COLO320-DM ecDNA.** The strongest remaining focal-amplification story (MYC on
  ecDNA, CN ~100). Blocked only by disk: the ONT data is raw fastq in
  `PRJNA1110283` (33-53 GB per run) and needs a genome-wide minimap2 run before
  anything is browsable.

Two datasets that are dead ends, so nobody re-checks them: **SK-BR-3** — every
file under `labshare.cshl.edu/shares/schatzlab/www-data/skbr3/` 404s, leaving
only raw PacBio CLR in SRA `PRJNA476239`, so the paper is design inspiration
only. **C-GIAB / HG008** has no RNA arm at all and cannot carry a fusion
tutorial. COLO829 has no matching RNA and K562 no usable hg38 WGS (ENCODE's is
hg19 and 337 GB), which is why the tutorial uses two cell lines.
