---
name: tutorial-grammar-followups
description: What the tutorial grammar passes of 2026-09-27 left open - the calls waiting on Colin, the figures whose config still comes from a copy the page does not print, and the defects seen in the figures and not fixed. Read before another sweep of the tutorials for keys, scales, axis titles or figure configs.
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

## Waiting on Colin

- **CNV reference lines** (population_cnv ladder, BIC-seq2 "two copies", cgiab
  BAF). He said "i might not do reference lines for cnv". Ask before adding.
- **The rGFA rank colour is still a jexl ternary**
  (`rank==0 ? blue : orange`) in `demos/hprc/config.json`,
  `demos/arabidopsis_pangenome/config.json` and the graph fixtures. As a
  threshold scale it would draw a key on every graph figure, so it is a
  picture call.

## Figures whose config is still a copy

- **cgiab keeps three id sets for four lanes.** The benchmark SV and CNV
  lanes, BAF and the subclonal CNV load from `demos/cgiab/config.json` under
  ids the page's fences do not use, and the page's `HG008-T_baf` and
  `hg008_subclonal_cnv` fences share ids with that config. Converging them
  means editing that config, which carries an undeployed change nobody has
  signed off (below).
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

- **Don't deploy `demos/cgiab/config.json`** until someone signs off the
  pending move from `defaultRendering` to `mark` on three wiggle lanes in it.
- **A synteny colour takes no `scale: "linear"`**; a numeric column is a ramp
  already, and `domainMin`/`domainMax` still pin it.
