---
name: per-region-banner-for-a-mixed-region-set
description: refusal is per region and the banner is per display, so the region that fit is downloaded and then not drawn; a visual call decides whether the banner narrows or the fetch widens
---

# A mixed region set banners the whole display

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. The prose that describes it is the thing that is wrong;
the three answers range from a per-region terminal state every display inherits
to correcting a commit message.

`de04cc1e5f` moved the byte gate inside the fetch and made the per-region family
refuse region by region. Its message describes the result as "a multi-region
view with one over-budget region draws the small ones and banners the big one
under alignments as it already did under canvas". **The fetch does that; the
chrome does not, and did not under canvas either.**

The two scopes differ:

- `fetchEachRegion` skips `onResult` and `commitRegion` for the refused region
  only, so the region that fit is stored and marked loaded.
- `commitFetchBytes` folds the batch to `largestRegionBytes(...)`, because the
  budget is what ONE region may cost (REGION_TOO_LARGE.md § "A budget has a
  scope"). One over-budget region therefore sets `estimatedFetchBytes` for the
  display.
- `regionTooLarge` is one boolean, `computeDisplayPhase` turns it into
  `tooLarge`, and `DisplayStatusChromeBase` early-`return`s that phase's own
  root — the canvas unmounts rather than being drawn over.

So on a mixed set the region that fit is measured, downloaded, parsed, stored
and marked loaded, and then not drawn, because the display it belongs to is
showing a banner. Against the pre-flight this replaced — which refused the whole
set before any features moved — the blocked case now costs the fitting regions'
payloads for no visible change. `multiRegionBannerScope.test.ts` pins the
mechanism so the claim cannot be re-derived from the commit message.

Reachable wherever regions differ in size at one `bpPerPx`: `showAllRegions`
over an assembly with one large chromosome and many small contigs, or a
two-region view holding a whole chromosome beside a gene.

## The call

Three answers, and the visual one decides which:

- **Narrow the banner.** The honest reading of the commit message, and the most
  work: `tooLarge` is a subtree swap today, so a per-region banner means the
  chrome grows a per-region terminal state that coexists with a mounted canvas.
  Every display composing `DisplayChrome` inherits whatever shape that takes.
- **Widen the refusal.** Put alignments back on whole-set refusal, so a mixed
  set downloads nothing, matching what the banner says. Cheapest, and it gives
  up the per-region fetch this commit bought.
- **Keep both and say so.** Leave the fetch per-region and the banner
  display-wide, and correct the prose. Costs the wasted payloads.

**First move:** decide whether a partially-refused display should draw at all.
Everything else follows — there is no measurement that settles it, which is why
this is here rather than under "measure first".
