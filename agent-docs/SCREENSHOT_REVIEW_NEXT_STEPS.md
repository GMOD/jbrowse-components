# Screenshot review — next steps

Follow-up to the screenshot-review pass (`website/scripts/screenshot-review.json`,
`screenshot-specs.ts`, `generate-screenshots.ts`). Most "bad" verdicts are now
fixed + verified; this tracks what was done and the few remaining judgment calls.

Regenerate a single spec with:

```bash
cd website
pnpm generate-screenshots --filter=<name> --exact   # serves products/jbrowse-web/build
```

The build must be current: `cd products/jbrowse-web && pnpm build` first if code
changed. Oversized PNGs (>~600KB) → `pngquant --force --quality=65-90 --output f f`.

## Key learning: declarative whole-genome views

Omitting `loc` from an LGV view spec triggers `showAllRegionsInAssembly` (see
`LinearGenomeView/afterAttach.ts`) — i.e. a **whole-genome view, all chromosomes,
declaratively**. The old "no-loc path races" warning only bites for *very slow*
remote configs (CGIAB); `config_demo.json` hg19 loads fast enough that the no-loc
path is reliable. This unblocked `cnv` and `bigwig/whole_genome_coverage` as
plain `sessionSpec`s (no menu-click "Show all regions" flow needed).

Also: COLO829 whole-genome coverage bigWigs **do** exist in `config_demo.json`
(`colo_tumor` / `colo_normal`, `…/genomes/hg19/COLO829/colo_{tumor,normal}.bw`) —
the earlier "no such bigWig" claim was wrong.

`spec.crop` is applied to **every** stage of a multi-stage figure before they're
`-append`ed, so a short single-track frame can be tightly cropped without
shrinking the capture viewport (which would clip menus mid-interaction).

## Done + verified this session

- **`alignments/arc_display`** — rebuilt on SKBR3 sniffles + Illumina at a real
  chr1→chr14 translocation breakpoint (chr1:9,113,000-9,130,000, sniffles call
  596_2); `readConnections:'arc'` draws red discordant-pair arcs. Window kept
  under `AUTO_FORCE_LOAD_BP` (20kb) so the high-cov CRAM loads without force.
- **`alignments/compact`** — HG002 Illumina hs37d5 2x250 (`illumina_hg002`),
  compact preset applied via `displaySnapshot`, "Set feature height…" submenu open
  with Compact boxed.
- **`alignments_track_arcs`** — moved to GAPDH (chr12, single-strand) so sashimi
  arcs are one color, not the overlapping fwd/rev arcs of the old ACTB locus.
- **`alignments/modifications1`** — fixed the menu drill (`Color by…` → `Base
  modifications (MM tag)` → `By modification type`, NOT the old "Modifications…"
  label) and boxed the option; zoomed locus loads so no regionTooLarge.
- **`cnv`** — rebuilt as a self-contained `MultiWiggleAdapter` sessionTrack over
  COLO829 tumor(red)/normal(blue) bigWigs, whole-genome, localsd ±3sd. Cropped.
- **`bigwig/whole_genome_coverage`** — single COLO829 tumor bigWig, whole-genome,
  localsd ±3sd, cropped. (next-steps §3 resolved.)
- **`horizontally_flip`** — 2-stage before/after composite: top normal, bottom
  after the view-menu "Horizontally flip" (`[rev]` locstring + reversed coords +
  flipped triangles). hg19 ACTB, `geneGlyphMode:'longestCoding'`, per-stage crop.
- **`breakpoint_split_view`** — `viewportHeight` 1200→900, drops the empty band.
- **`sv_cgiab/cnv_show_all_regions`** — confirmed the import start screen with the
  "Show all regions in assembly" button; cropped to the form.
- **`alignments_soft_clipped`** / **`alignment_clipping_indicators`** — code fixes
  from the prior session (590bb9d) re-verified: soft-clip per-base letters render;
  clip-indicator bars scale with coverage height.

## Remaining judgment calls

- **`multisv`** — the committed figure is a 4Mbp chr19 inversion overview
  (chr19:42,749,096-46,768,427) with force-loaded high-coverage 1KGP sample tracks
  and the track selector deliberately open; `sv_multisamples.md:117` describes
  that selector. A faithful offline rebuild would have to force-load ~30x
  alignments across multiple samples over 4Mbp (impractical/slow). **Decision:
  keep the figure + caption as-is** (internally consistent); the reviewer's
  "hide the selector" ask is best satisfied by a live re-share if still wanted.
- **`skbr3_translocation`** — `curated: true` on purpose (at 1500px the PacBio CRAM
  force-loads instead of drawing reads). Re-share at a tighter zoom to re-enable
  autogen, or leave curated.
- **`inverted_duplication`** — empty review note; user said leave it.
- **`alignments_sort_by_base`** — reviewer wants the right-click→"Sort by base at
  position" *workflow* captured (the menu over the SNP), not just the declarative
  sorted result. Needs an empirical canvas right-click row (no DOM for reads); a
  two-stage capture (right-click menu, then sorted result) is the path. NOT done.
- **`rnaseq/compact_stacked`** — reviewer: "not clear compact is used"; make the
  `featureHeight:3/spacing:0` more obviously compact or annotate. NOT done.
- Stale captions worth a light pass (figures fine): `dotplot_view.md:18`
  (old appbar wording), `sv_visualization_cgiab.md:246` (compact/sort not set).

## Close the loop

After re-reviewing the changed shots, clear their verdicts:

```bash
cd website
pnpm review-screenshots-web         # gitignored screenshot-review.json
```
