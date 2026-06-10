# Screenshot review — next steps

Follow-up to the screenshot-review pass (`website/scripts/screenshot-review.json`,
`screenshot-specs.ts`, `generate-screenshots.ts`). Most "bad" verdicts are done
and verified; this tracks what remains.

Regenerate a single spec with:

```bash
cd website
pnpm generate-screenshots --filter=<name> --exact   # serves products/jbrowse-web/build
```

The build must be current: `cd products/jbrowse-web && pnpm build` first if code
changed. Oversized PNGs (>~600KB) → `pngquant --force --quality=65-90 --output f f`.

## Done + verified (no action)

19 specs regenerated and visually checked, incl. the 3 that were silently broken
by the removed `"Type of add track workflow"` string (`add_track_form`,
`recent_tracks`, `multiwig/addtrack`). `modifications` confirmed correct in
current code (the per-cytosine winner-selection in `extractMethylation` bounds
the coverage stack; old committed shot predated it; matches IGV
`BaseModificationCoverageRenderer`, no clamp). See git log on `webgl-poc`.

## 1. Manual live re-shares (cannot be done offline)

Share-link session state (open track selector, autoscale, glyph mode) is stored
server-side and can't be edited from the spec. Re-share each from a live JBrowse
with the fix applied, then paste the new `share-XXXX`/`password` into the spec.

- **`cnv`** — set the multiwiggle display to Local +/-3sd autoscale, or fixed
  `minScore 0 / maxScore 200`. (No COLO829 whole-genome coverage bigWig exists in
  `config_demo.json`, so a `sessionSpec` rebuild isn't possible — must re-share.)
- **`multisv`** — close the track selector. NOTE: `sv_multisamples.md:117` caption
  deliberately describes "the track selector panel on the right"; decide whether
  to hide it (and reword the caption) or keep it (and drop the review note).
- **`horizontally_flip`** — it's a before/after composite (`basic_usage.md:227`,
  gallery), so one session can't reproduce it. For the gene-glyph note: there is
  no `'show only genes'` mode anymore — use `geneGlyphMode: 'longestCoding'`.

## 2. Regenerate to confirm (remote, slow/flaky — not yet verified)

- **`sv_cgiab/cnv_show_all_regions`** — spec was reworked from the unreliable
  no-`loc` auto-all-regions path to the `lgv_assembly`-style launch-view flow
  (click "Launch view" -> wait "Show all regions in assembly"). CGIAB remote data
  is very slow; regenerate once to confirm it captures the start screen the
  caption describes (`sv_visualization_cgiab.md:259`).

## 3. Larger rebuild (flagged, spec unchanged)

- **`bigwig/whole_genome_coverage`** — wants a multi-stage figure (open track ->
  set menu options -> whole-genome result). Recipe: `sessionSpec(DEMO_CONFIG,...)`
  with track `colo_tumor` (hg19 BigWig), seed a `loc` then action: view menu ->
  Show... -> "Show all regions in assembly" (the no-`loc` auto path races); set
  the tuned look declaratively via `displaySnapshot` (`autoscale: 'localsd'`,
  height, resolution) rather than fragile menu clicks; stack the steps with
  `stages`. Needs a generator run to confirm the all-regions frame isn't empty.
  Caption: `quantitative_track.md:61`.

## 4. Low priority / judgment calls

- **`skbr3_translocation`** — `curated: true` on purpose (at 1500px the PacBio CRAM
  force-loads instead of drawing reads). Re-share at a tighter zoom to re-enable
  autogen, or leave curated. Empty review note.
- **`inverted_duplication`** — elaborate spec, empty review note; no actionable
  change identified. Confirm what (if anything) is wrong.
- Stale captions worth a light pass (figures are fine): `dotplot_view.md:18`
  (old appbar wording), `sv_visualization_cgiab.md:246` (mentions compact/sort the
  spec doesn't set).

## 5. Close the loop

After the above, re-review just the changed shots and clear their verdicts:

```bash
cd website
pnpm review-screenshots-web         # gitignored screenshot-review.json
```

The ~19 done items can be re-approved; only the items in sections 1-3 should
remain flagged.
