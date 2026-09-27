---
name: sbx-duplex-yc-colouring
description: Roche SBX duplex reads carry a per-base yc tag marking duplex-concordant, duplex-discordant and simplex-tail spans. A dedicated per-base colour scheme, decoding yc in the feature detail panel, and optionally discordant positions as mismatch-style marks.
---

# SBX duplex reads: `yc`-tag colouring

Split out of the alignments collection on 2026-09-27.

Roche's sequencing-by-expansion (SBX, AXELIOS platform; XOOS analysis tools) emits
**duplex consensus reads** (SBX-D) that merge both strands (R1+R2) of one
molecule. The `yc` aux tag encodes, per base, one of three confidence classes:
**duplex-concordant** (both strands agree — high confidence), **duplex-discordant**
(strands disagree, a mismatch/indel between R1 and R2 — low confidence), and
**simplex tail** (only one strand covers — medium). Format is
`{left_tail}{±}{duplex}{±}{right_tail}`: `+`/`-` mark the contributing strand,
numbers are runs of concordant bases, letters are individual discordant positions
(a lookup table maps each letter to the R1→R2 base pair). Example `4+13-3` = 4 R1
tail bases, 13 concordant duplex bases, 3 R2 tail bases.

Key architectural fact: the XOOS demux tool **also bakes the three classes into
the QUAL string** as three fixed Phred values (concordant=Q39, discordant=Q5,
simplex-tail=Q22). So our existing **Color by → Per-base quality** overlay
(`features/perBaseQuality`, reads `NUMERIC_QUAL`) *already* renders the duplex
structure on SBX-D data today — discordant bases show as low-quality streaks — just
unlabeled and on a generic gradient. Incremental work is legibility, not plumbing.

Proposed, ranked:
- **A dedicated "SBX duplex" per-base color scheme.** `features/perBaseQuality`
  and `features/perBaseLetter` are the exact template: an `extract.ts` that reads a
  tag (`getTagAlt(feature, 'yc')`, same idiom as MM/ML) and walks
  `forEachAlignedBaseInRegion(cigar, start, region, …)` to emit per-ref-base
  entries, plus a GPU/canvas overlay over the `normal` body. Register in
  `COLOR_SCHEMES` (`shared/colorSchemes.ts`) + the `ColorSchemeType` union
  (`shared/types.ts`) — a compile error until classified with a shader path + menu
  placement — and it appears in the Color-by menu with a legend (green concordant /
  red discordant / grey simplex). **Open question first:** confirm whether aligned
  SBX-D BAMs carry `yc` into the output or only the Q39/Q5/Q22 QUAL encoding; if the
  latter, drive the scheme off QUAL bins instead of parsing `yc` (even simpler, no
  new extract).
- **Decode `yc` in the feature detail panel** (`AlignmentsFeatureDetail/tagInfo.ts`).
  Today `yc` shows as a raw string; a small decoder renders "N concordant / M
  discordant / tails R1=x R2=y" plus the discordant-position breakdown. Cheap,
  self-contained.
- **(Optional) Discordant positions as mismatch-style marks** — the low-confidence
  calls a variant reviewer cares about, surfaced without switching schemes. Overlaps
  the color scheme; only if per-base coloring proves too subtle at genome scale.

Explicitly **not** in scope: R1/R2 reconstruction from `yc` — that's a
data-processing concern for the caller/collapser (XOOS), not the browser; JBrowse's
job is surfacing the confidence classes. Pairs naturally with the
"Color-by → coverage summarization" concordant/discordant partition idea above.
Example data: Roche's GIAB SBX-D BAMs (HG001/HG002) at `sequencing.roche.com/SBXdata`
/ the XOOS `web.sbxdata.kamino.platform.navify.com` platform; the XOOS repo
(`github.com/Roche-AXELIOS/XOOS`) ships the demux source but no small BAM fixtures,
so a region-sliced GIAB BAM is the path to a test fixture. Docs:
`roche-axelios.gitbook.io/xoos` (SBX-D read-interpretation + yc-tag guide).
