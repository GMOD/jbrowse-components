---
name: tutorial-grammar-followups
description: What the tutorial grammar passes of 2026-09-27 left open - the calls Colin settled, the figures whose config still comes from a copy the page does not print, and the defects seen in the figures and not fixed. Read before another sweep of the tutorials for keys, scales, axis titles or figure configs.
---

# Tutorial grammar pass: follow-ups

Three rounds on 2026-09-27 applied the grammar of graphics to the tutorials, on
Colin's steer that every change shows readers how to do it themselves, as a
menu path or a config they can paste
([[tutorials-teach-the-route-not-the-capability]] in memory).

The third round made the figure draw the page's config rather than a copy:
`pageTrack(doc, trackId)` in `website/scripts/specs/pageTrack.ts` returns the
page's `json addtrack` fence, and `check-specs` fails a session track the
spec's config already holds, which `addSessionTrackConf` drops. The history is
in git; what follows is what is left.

## Settled by Colin, 2026-09-27

- **No CNV reference lines** (population_cnv ladder, BIC-seq2 "two copies",
  cgiab BAF): the copy-number keys and the diverging scale already name the
  diploid level, so a line would restate the key.
- **The rGFA rank colour is a threshold scale** with a key ("reference" /
  "other assemblies") in `demos/hprc`, `demos/arabidopsis_pangenome`, the
  graphgenomeview fixtures and `specs/graph-ecoli.ts`. Only a lane opened as
  `LinearBasicDisplay` reads it, since `LinearGraphDisplay` colours through
  its own `colorScheme`, so five figures took the key rather than every graph
  figure. The portal configs under `jb2hubs/website/pangenome-config` keep
  the ternary: they have to load in older releases. Colin's standing
  preference is the reference-position rainbow for graph panes; the rank
  scale is a demo colouring for the linear lane.

## Figures whose config is still a copy

- **cgiab's benchmark lanes load under the page's ids** since 2026-09-27:
  `demos/cgiab/config.json` carries `hg008t_benchmark_sv` and
  `hg008t_somatic_cnv` as the page's fences spell them, and every spec names
  those. The old ids (`GRCh38_HG008-T-V0.5_…draftbenchmark.vcf`, `…calls`,
  `hg008_cnv_calls`) stay in the config until the site redeploys, because the
  live tutorial's figure links still open them. Drop them after that deploy.
- **A figure on a hosted demo config draws the config's track, not the page's
  fence.** Nothing compares those two copies either; hg002's gene tracks were
  one such pair (the page and `demos/hg002` now agree).
- **The gene-track channel spec** is the one paste `check-paste-configs` still
  holds, because the page prints it as an untagged fragment.

## Seen in the figures, not fixed

- **Row labels sit over the first region's data** in every multi-row display
  (mark, multi-wiggle, multi-sample variant, MAF): `RowLabelsOverlay` floats
  them over the plot on an 80% paper background. It is the house layout, so a
  gutter is a design change for all of them, not a mark-display fix.
- **The floating colour key covers data** at the top right of a lane
  (`pangenome/maf`'s genotype key over the strain rows). A lane shorter than
  its key scrolls the key rather than clipping it, which a still cannot show;
  the two cattle figures whose key lost yak that way took 40 px more lane.

## Fixed on 2026-09-27, after the third round

- `sv_cgiab/synteny_view` captures again. The synteny rows caption each
  scalebar with a bare assembly-name chip now, so the row callouts anchor to
  `refLabel-prefix` scoped by `view`, which a selector or text anchor honours
  as of this round (`annotationOverlayScope.test.ts`).
- The In(2L)t fade was the inversion glyph: a triangle whose point spanned the
  whole cell, so an 11 Mb inversion in 2 px rows was a 900 px sliver whose
  antialiased edges read as a gradient. The point is now one cell height long
  (`inversionTipPx`), and the rest of a wide cell draws solid.

## Not built, with the reason

- **E. coli depth/presence and k562 DepMap segments as marks over BED**, which
  would drop `bedGraphToBigWig`: two build scripts, two demo configs and five
  figures, for pictures the multi-wiggle already draws.
- **genomes_basics keys** for cCRE, gnomAD and phyloP belong in jb2hubs output,
  which has to keep loading in older releases.
- **genomes_proteins' pLDDT** track is declared in the external protein3d
  plugin.
- **pangenome_cactus strain-count line** on `builders.png`: the Cactus flank
  sits near 4, so a line at 5 raises a question the page does not answer.
- **read_marks thresholds** (2 kb, "10 pairs") are optional.
- **mcscan block strand key**: the ribbons already show orientation.
- **chromhmm's Broad track** stays on the derived key, which the page uses to
  teach the identity-scale fix below it.

## Traps

- **A synteny colour takes no `scale: "linear"`**; a numeric column is a ramp
  already, and `domainMin`/`domainMax` still pin it.
