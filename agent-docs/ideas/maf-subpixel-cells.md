---
name: maf-subpixel-cells
description: MAF's GPU cell floor is measured in device px, so the display renders differently on a retina monitor than on a plain one and differently from its own Canvas2D fallback, which has no floor at all; three ways to settle it, why alignments' sizeAlpha is not one of them, and the capture that would decide.
---

# What a sub-pixel MAF cell should look like

`rowRect.slang` is drawn by two renderers, and they feed its `viewportWidth`
uniform in different units. That uniform is only ever the denominator of
`extendToMinWidthX`, so it is exactly the minimum cell width:

| renderer | uniform | min cell width |
| --- | --- | --- |
| multi-row features | `clip.scissorW` (CSS px) | 1 CSS px |
| MAF | `clip.pxW` (device px) | 1 device px — **0.5 CSS px at dpr 2** |
| MAF Canvas2D (`drawMafBlocks`) | — | none; natural sub-pixel width |

Both GPU renderers carry a comment saying the disagreement is deliberate and
unresolved. What neither says is the consequence: **MAF's floor moves with the
monitor**, and MAF's two backends do not agree with each other at any dpr. That
half is a defect on its own terms — a display whose appearance depends on the
reader's screen is one whose figures are not reproducible, and cross-backend
parity is what the whole `browser-tests/compare-backends.ts` gate exists to
hold.

The other half — what the floor *should* be — is a real question, and the
answer is not obvious.

## Why this is more visible in MAF than anywhere else

MAF cells are **run-merged**: consecutive same-colour bases become one rect. A
sub-pixel cell therefore does not mean "we are zoomed out", it means **this run
is shorter than a pixel** — a stretch where the alignment alternates every base
or two. A multiple alignment across species is full of those, far more than a
BAM pileup against its own reference is. So the sub-pixel case is MAF's normal
case at any interesting zoom, not an edge one.

That is what makes each candidate visible rather than academic:

- **Floor, alpha 1** (today's GPU). Every short run claims a whole pixel and the
  last one drawn wins. A noisy stretch reads as whichever colour had more
  *runs*, which is not the same as more *bases* — the picture over-states
  whichever state is fragmented.
- **No floor** (today's Canvas2D). Runs draw at true width. Canvas2D antialiases
  them, so a pixel ends up near the base-weighted mix, which is the honest
  answer. On the GPU the target is 4× MSAA, which quantises horizontal coverage
  far more coarsely than Canvas2D's rasteriser — a 0.25 px cell lands on 0 or 1
  of the available sample positions, so the same nominal rule does not give the
  same picture on the two backends. **This is the part that needs looking at
  rather than reasoning about.**
- **Floor + a span-proportional alpha.** Widen to a visible minimum, then scale
  alpha by the true span so the ink is conserved and overlapping runs blend.

## `sizeAlpha` is not the answer here, and alignments says so

The third option is the shape `plugins/alignments` already ships
(`alignmentsUniforms.slang`), and it is tempting to lift. Don't, without
re-deciding: **alignments deliberately applies it to indels and not to
mismatches**, in its own words —

> Indels only. A mismatch is a point event whose whole value is being visible
> when a screen holds more bases than pixels — a SNP column carried by every read
> must stay opaque there, which is exactly what the frequency lerp is for. An
> indel at that zoom is noise, and a big one still survives on its own span.

A MAF cell is per-base identity. It is the mismatch analogue, not the indel one,
so alignments' own reasoning argues *against* fading it. The counter-argument is
that alignments' mismatches are **sparse** — a marker on an otherwise matching
read — while MAF cells **tile**, so "stay visible" is satisfied by the row being
covered no matter what, and the open question is only what colour a shared pixel
takes. Both readings are defensible. That is the decision, and it is an aesthetic
one about what a dense alignment should look like, not a correctness one.

`sizeAlpha` also pairs with a floor rather than replacing one: it exists to give
back the ink a *widened* mark took. Applying it to a cell drawn at natural width
would double-count the narrowness and wash the row out.

## What would settle it

The existing MAF browser suite already captures at `ctgA:1-4000`, which over a
~1000 px canvas is ~4 bp/px — well into the sub-pixel regime for any run under
four bases. So the three candidates are separable by capturing that one view
under each and looking, and the snapshot machinery to diff them is already
there.

Do that before changing the shader. Everything above is arithmetic and can be
reasoned about; which of the three *looks* like a multiple alignment cannot.

## Do not fix half of it

The dpr-dependence is the tempting quick win — swap MAF's `clip.pxW` for
`clip.scissorW` and it stops moving with the monitor. Resist it as a standalone
change: it raises MAF's floor from 0.5 to 1 CSS px, moving the GPU backend
*further* from the Canvas2D twin it already disagrees with, and it does so in
the direction of flattening exactly the sub-pixel texture the display is for. If
the answer turns out to be "no floor", the same commit fixes the dpr-dependence
for free.
