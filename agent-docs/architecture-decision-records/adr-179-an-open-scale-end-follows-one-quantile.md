---
status: Accepted
summary: "An unpinned end of a value scale or a colour ramp follows one number, `domainQuantile`: at 1 the loaded values' extremes, below it that quantile of each sign's magnitudes anchored at 0, through one exact rule (`quantileExtent`, a nearest-rank quickselect). It replaces `scales.y.autoscale` with `numStdDev` and `numQuantile`, and the ramps' `autoscale` with `numQuantile`; `localsd`, the mean-plus-sigma mode, is gone. The wiggle plot starts at 0.99 and the Hi-C colour at 0.95; everything else at 1. Amended 2026-09-26: the coverage band starts at 0.99 too The Score menu's Autoscale type radio is a Clip outliers checkbox"
---

# ADR-179: An open scale end follows one quantile

## Status

Accepted (2026-09-26). Colin: "numStdDev is kind of a funky historical
thing. if there is more standard approach from ggplot2 or other grammars we
should use that", after asking for a holistic pass over the grammar.

## Context

`scales.y` chose what an unpinned end follows through an enum and two numbers:
`autoscale: local | localsd | localpercentile`, `numStdDev` for the second and
`numQuantile` for the third. [ADR-175](adr-175-a-colour-ramps-open-end-follows-the-data-as-y-does.md)
had just given the colour ramps the same pair less `localsd`. Two spellings of
one policy, three slots for one number, and a mode no grammar has: `localsd`
is a mean-plus-sigma band that assumes a bell around the mean, on data
(coverage, copy number, conservation) that is one-sided and spiky, which is
what the percentile was added to handle.

The grammars were checked before the spelling was chosen. ggplot2 has
`limits` and `oob` (`oob_censor`, `oob_squish`, `oob_keep`) and no automatic
robust domain: a reader computes `quantile(x, .99)` and pins it. Vega and
Vega-Lite have `domain`, `domainMin`, `domainMax`, `domainMid`, `domainRaw`
and `clamp`; their "quantile scale" is a discrete range over quantile
boundaries, a different thing. Observable Plot the same set. GenomeSpy,
Gosling, IGV and pyGenomeTracks pin or take the extremes. So no grammar
names this policy, and a genome browser needs one: a BigWig with one
repeat pile-up draws as a flat line under the plain extremes, and a track
that starts that way reads as broken.

## Decision

**One number, `domainQuantile`, beside `domainMin`, `domainMax` and
`domainMid`**, on `scales.y` and on every colour ramp (FeatureColor,
MarkColor, AlignmentsColor, HicColor). `1` follows the loaded values'
extremes; below it each sign's magnitudes are clipped at that quantile,
anchored at 0, so a sparse minority tail stays visible and all-positive data
keeps its bottom at 0. The value clipped above that draws at the top, which is
ggplot2's `oob_squish` and Vega's `clamp`.

**One rule, `quantileExtent`** (`@jbrowse/core/util/quantileExtent`, the
renamed `rampExtent`): the nearest-rank quantile by quickselect, exact where
the histogram `scales.y` used to walk collapsed skewed data into its bottom
bucket. Hi-C's contact counts went through the same quickselect at a floor
rank, one rank lower for most counts; since 2026-09-26 they take this rule's
rank through `quantileOf`. The wiggle
family, the mark display, the coverage band and every ramp read it; the
coverage band clips the peaks of the bins in view and gains the option, having
offered only `local` and `localsd` before.

**`localsd` and `numStdDev` are gone.** A v4 session's `autoscale` lifts to
`domainQuantile`: `localpercentile` to 0.99, the others to 1. The v5-beta
spellings (`scales.y.autoscale`, `numQuantile`, the ramps' `autoscale`) lift to
nothing and fail loudly, since every one of those objects is `closed`; Hi-C's
retired `useColorPercentile` checkbox lands on `domainQuantile`.

**Defaults stay the display's**: the wiggle plot at 0.99 and the Hi-C colour at
0.95, the coverage band, the mark display and the other ramps at 1. The Score
menu offers **Clip outliers**, a checkbox that writes the display's declared
quantile where that is below 1 and 0.99 otherwise, and 1 to turn it off;
Hi-C's "Emphasize faint contacts" is the same checkbox under its own name.

### Amended 2026-09-26: the coverage band starts at 0.99

The coverage band had kept 1 because its old modes lifted there, not for a
reason of its own, and it has the wiggle plot's failure: one collapsed-repeat
pile-up sets the top and every other bar reads as flat. Its quantile runs over
the covered bins' peaks, so a sparse window does not clip to nothing. The mark
display, and Manhattan with it, keeps 1: a plot built on purpose is often
about its outliers, a genome-wide hit or a high-QUAL call, and a point clipped
to the top edge reads as a value sitting there. Colin agreed on 2026-09-26.

## Consequences

- `valueScaleSchema({ domainQuantile })` takes a number, not modes; the
  `ScoreScaleModel` interface carries `domainQuantile`, `clipQuantile` and
  `setDomainQuantile`, and `AutoscaleModel` is gone.
- `ScoreStats` is the two extremes; the mean and standard deviation, and the
  coverage sidecar's per-bin sums, are not computed or shipped any more.
- `jb2export` drops its `autoscale:` modifier; `scales.y.domainQuantile=0.99`
  is the slot path, as for any slot.
- The exact quantile moves a clipped axis by up to a thousandth of its range
  against the histogram, so the wiggle figures captured under
  `localpercentile` may drift by a tick; the weekly sweep refreshes them.
- The figures that named `localsd` or `local` (`bigwig/whole_genome_coverage`,
  `multiwig/cluster_dialog`, the three `qc/smn_*` coverage bands, `sv/cnv`)
  and the one that clicked the radio (`alphagenome/variant_difference`) are
  re-shot in the landing.

## Rejected alternatives

- **Keeping the enum with `localsd` dropped** (`autoscale: local |
  localpercentile` plus `numQuantile`): two slots and an enum for one number,
  where the enum's two values are `1` and `< 1`.
- **No automatic clipping**, the pure ggplot2 form: the wiggle default becomes
  the extremes and a spiky BigWig reads as flat out of the box, with the pin as
  the only remedy. The default that survives one spike is the reason the slot
  exists.
- **A radio over presets** (extremes, 99th percentile, 95th): a config holding
  0.9 would tick nothing, and the labels would name numbers the config may not
  hold. A checkbox says the one thing a reader decides.
- **Keeping the histogram for `scales.y` and quickselect for the ramps**: two
  implementations of one rule, one of them approximate on the data the rule is
  for.
