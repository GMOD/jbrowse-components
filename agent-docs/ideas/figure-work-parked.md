---
name: figure-work-parked
description: Three figures the screenshot review left behind: the wheat Compara rebuild nobody has costed, a curated ortholog palette that means changing core `randomColor`, and a per-level dotplot scale that `squareView()` cannot express.
---

# Figure work parked on a cost or a decision

Three items the screenshot review surfaced and then left, each because the next
move is expensive or is not the implementer's to make.

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
