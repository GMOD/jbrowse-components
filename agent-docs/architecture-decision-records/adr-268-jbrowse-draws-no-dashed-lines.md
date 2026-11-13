---
status: Accepted
summary: "Every line JBrowse draws by default is solid. A read connector over segments not in view paints its own keyed grey; other lines differ by color and weight. The link mark's `strokeDash` stays for a config that asks"
---

# ADR-268: JBrowse draws no dashed lines

## Status

Accepted (2026-11-13), by Colin's ruling: "I do not like dashed lines at all
... jbrowse should not use them." Extends the arc band's rule (ARC_BAND.md:
"No mark in the band is dashed") to everything JBrowse draws. Amended the same
day: the hidden-segment junction takes a grey of its own, Colin's pick from six
prototyped treatments.

## Context

Dashes marked a different kind of line in several unrelated places: a read
connector stepping over segments of its read the view never fetched, a score
plot's reference lines and the read cloud's insert range, the tandem repeat
panel's reference allele, the center line, the pileup truncation rule, a
circular view's elided regions, a solo's pending box, an automatic color
swatch and the file drop zone. Each picked its own dash, and a dash broke
into noise at a hairline and in a downscaled figure.

## Decision

- **Every default line is solid.** The connector mark has no dash bit, no
  dash uniforms and no along-the-curve length; sv-core has no
  `HIDDEN_SEGMENT_DASH`; the alignments tables have no `dashed` connector
  column.
- **A hidden-segment junction says so in its color, and its hover names the
  loci.** In the alignments display and its tables it paints the
  `readThroughHidden` palette neutral (`colorThroughHidden`) in place of its
  class color, solid and 1.5 px like every connector, and keys "Split read
  (segment not in view)" in place of its class row: the unseen segment is what
  the class turns on, so no class color is the honest answer. Declined in the
  prototype: the class color faded toward grey (still claims a class), an X at
  the curve's midpoint on each connector or one per bundle (a second mark
  vocabulary for one fact, and noise in a bundle of reads), grey with the X,
  and 14 px stubs from each end with no curve (loses where the read goes).
  `hiddenSegmentsNote` names the skipped loci in the alignments display and the
  breakpoint split view, and a junction whose ends share a row still bows up
  over the row rather than lying on the chain's connecting line.
- **A line that a dash set apart is set apart by color or weight.** Reference
  and insert-range lines are a darker grey than the faint grid; the elided
  arc takes the disabled grey; a pending solo keeps its accent color and wash.
- **`linkMark`'s `strokeDash` stays.** It is a grammar option that dashes
  only where a config writes it, and nothing in the tree does.

## Consequences

- A static figure (jbrowse-img, a figure spec) of the alignments display shows
  a connector across an unfetched segment as the grey and its key row; only
  the skipped loci need the hover. The breakpoint split view still paints such
  a connector its class color and says so in its hover alone, so the docs tell
  a figure author to add the missing panel there.
- Figures shot before this change still show the dashes until they are
  re-shot.
