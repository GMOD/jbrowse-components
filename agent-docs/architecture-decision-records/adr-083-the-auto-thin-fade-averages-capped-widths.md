---
status: Accepted
summary: "'auto' asks whether ribbons are predominantly sub-pixel and answered with a plain mean, which follows the widest blocks; a liftOver chain's whole-arm blocks held the fade off over a view 96% sub-pixel, so each block now votes at no more than 2 px"
---

# ADR-083: The auto thin-fade averages capped widths

## Status

Accepted (2026-08-21). Refines the criterion introduced by `4f1c8ebd97` and
latched by `f48af92b65`; the fade itself is
[ADR-033](adr-033-synteny-lod-prune-at-data-draw-crisp-at-shader.md).

## Context

`fadeThinAlignmentsMode: 'auto'` turns the width-proportional ribbon fade on when
a display's ribbons are, in its own docstring's words, "predominantly sub-pixel".
It measured that as the **mean** on-screen block width over the display's fetched
population, below 1 px, with a ten-block floor and (since `f48af92b65`) a 1 →
1.25 px deadband held in a latch.

A mean over alignment-block lengths follows the widest blocks, not the commonest,
and the two shipped synteny datasets sit on opposite sides of that:

| file | blocks | median span | mean span | ratio |
| --- | --- | --- | --- | --- |
| `peach_grape.paf`, Pp01 | 3,438 | 683 bp | 1,015 bp | 1.5x |
| `hg38ToHs1.over.pif`, chr1 query axis | 470 | 130 bp | 615,963 bp | 4,738x |

The PIF is a UCSC liftOver chain — `test_data/hg38_hs1_synteny/config.json` ships
it — and a chain carries a handful of whole-arm blocks among thousands of
fragments. So on chr1 at whole-chromosome zoom in a 1000 px view the criterion
reads `2.48 px` and declines to fade, while **452 of the 470 blocks (96%) are
sub-pixel** and the median block is 0.0005 px. Panning the whole chromosome at
six zooms by two widths, it fades **0% of the pan at every one of the twelve**. It
does fade at whole-*genome* zoom (0.153 px), so opening a chromosome from the
whole-genome view switches the fade off — the opposite of the "relaxes on
zoom-in" the docstring promises.

Nothing downstream rescues that picture. `minAlignmentLength` defaults to 0 and
`MIN_CIGAR_PX_WIDTH` gates only indel detail, so all 452 hairlines are drawn, each
as a 1 px band at full alpha. `reference/SYNTENY_LOD.md` names this mode as the
answer to the visual hairball, and ADR-033 describes it as "a dense hairball
fades"; neither is true on chain-derived data.

## Decision

**Each block votes at no more than `FADE_WIDE_BLOCK_PX` = 2 px before the mean is
taken** (`cappedMeanWidthPx`). The criterion keeps its shape — one width against
1 px, releasing at 1.25 px, latched — and the cap costs a `Math.min` inside the
sum the display was already computing.

Measured with the shipped `cappedMeanWidthPx` + `fadesThinAt` over both files,
sampling every fetch-window rollover across a whole chromosome. "Loud" flips are
the ones between two windows that each hold 50+ blocks, i.e. the ones that
visibly repaint a hairball:

| | plain mean | capped mean |
| --- | --- | --- |
| `peach_grape` Pp01, share of pan faded | 36–100% | 100% |
| `peach_grape` Pp01, loud flips per chromosome pan | 2 | 0 |
| `hg38ToHs1` chr1, share of pan faded (≥10 Mb views) | 0% | 100% |
| `hg38ToHs1` chr1, loud flips per chromosome pan | 0 | 0 |

The plain mean's two loud flips are the borderline zooms where it dithers,
fading only the last third of a pan (0.96 Mb at 1000 px, 3.99 Mb at 4000 px);
capped, both commit for the whole pan. The capped mean's remaining flips at
5–10 Mb views on the chain file all fall between windows holding fewer than 50
blocks, where there is no hairball to repaint.

## Alternatives, all measured and declined

- **The median, i.e. the fraction of blocks that are sub-pixel.** The statistic
  the word "predominantly" actually names, and correct at every wide zoom on both
  files. It costs **5 to 11 extra flips per chromosome pan** at 5–10 Mb views on
  the chain file: that population swings 7 → 155 blocks across rollovers and the
  median hops between the 130 bp mode and the 10 Mb one. A mean moves smoothly
  with its population; a rank statistic does not. Same verdict for an explicit
  fraction threshold, which is the same number.
- **Sub-pixel ribbons per pixel of view width.** The most stable candidate (0
  flips anywhere) and the shape ADR-033's prose implies. At 0.5/px it never fires
  on `hg38ToHs1` chr1 at all — the density peaks at 0.45/px in a 1000 px view and
  0.11/px in a 4000 px one — and it stops fading `peach_grape` at 4000 px where
  today it fades. A count per pixel needs its threshold picked per window width
  to say anything, which the width thresholds do not.
- **Restricting the statistic to the visible window instead of the fetch
  window.** The obvious "measure what is on screen" fix, and it is much worse: 5
  to 29 flips per chromosome pan against 1, because the fetch window's pan buffer
  is what makes the sample large enough to threshold at all. Roughly 80% of the
  population is off-screen and that is load-bearing.
- **Dropping the latch now that the statistic is robust.** Still no. A
  single-threshold density criterion — the steadiest candidate — flipped three
  times over one chromosome pan at 1.91 Mb in a 1000 px view, where the density
  ranged 0.30 to 0.82 across rollovers. Every candidate needs the deadband.
- **Hysteresis on the ten-block floor too** (engage at 10, hold at 5). Fixes one
  row and breaks another, and every flip it addresses is between windows holding
  fewer than 50 blocks. Re-measured by magnitude rather than by flip count, which
  is the axis that settles it: the count bar is where 1,105 of the chain file's
  1,323 flips happen, and holding at 5 does halve the ones that change on-screen
  ink by 2x or more. But every one of the 11,247 sampled pan positions where the
  hold disagrees with a plain bar is `full` → `faded`, and the median one has
  **two visible ribbons**. The deadband does not steady a hairball; it keeps the
  fade on across a near-empty stretch of the pan, leaving one to four hairlines at
  `WIDTH_FADE_FLOOR` — the thing the ten-block floor is there to prevent.
  [ADR-085](adr-085-the-thin-fade-decision-snaps.md) has the sweep.

## Consequences

- The sum is now **O(numFeats) per zoom** rather than per fetch, because the cap
  is a pixel width: 4.2 ms over a million-block whole-genome PAF — where the
  answer is nowhere near either threshold — and 0.4 ms at a hundred thousand. If
  that ever bites, the escape is a sorted-span prefix sum (one 40 ms sort per
  fetch at a million blocks, then O(log n) per zoom), **not** a cap quantized to
  the zoom bucket: an effective cap wobbling between 2 and 4 px moves the
  statistic by more than the threshold it is compared against.
- `FADE_WIDE_BLOCK_PX` has to stay above the release width. A capped mean cannot
  exceed its cap, so a cap at or below 1.25 px would leave every view faded
  forever.
- The fade now engages on chain-derived PIF from about 10 Mb out. **This has been
  verified arithmetically from the file, not in a rendered picture** — what is
  measured is the decision, not whether the faded hairball reads better.

## Related

- ADR-085 (what the decision changing looks like, and the three transition
  designs declined with this one)
- ADR-033 (the fade itself, and why indels are not faded)
- `f48af92b65` (the deadband and the latch), `4f1c8ebd97` (the mean criterion,
  which replaced a coverage fraction that under-fired on the same kind of data)
- `reference/SYNTENY_LOD.md` (which names this mode as the hairball answer)
