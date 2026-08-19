---
name: figure-work-parked
description: Four figures parked on a cost or a decision: the wheat Compara rebuild nobody has costed, a curated ortholog palette that means changing core `randomColor`, a per-level dotplot scale that `squareView()` cannot express, and a 4-5 hour wolf-ancestry sweep across all autosomes.
---

# Figure work parked on a cost or a decision

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
