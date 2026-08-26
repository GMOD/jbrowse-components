---
name: todo
description: The v5.0.0 release list — the fifteen items the release itself turns on, grouped by what you have to do first: take it, get a visual call, or measure. Everything else that used to be here is in ideas/. Read when picking up work, and before filing anything new here.
---

# Backlog

**This file is the v5.0.0 release list**, and the bar for a row is that the
release ships worse without it: a check owed on code that landed in the v5
window, something the release itself publishes, a setting the rewrite dropped, or
a number a release note would quote. Fifteen entries clear that bar.

**A real bug is not automatically a row here.** Thirty-four entries left on
2026-08-26 — measured picture defects among them, not just proposals — because
nothing about the release turns on them. They are in [ideas/](ideas/README.md),
one file each, every one carrying a note at its top saying what moved it. File a
new find there unless v5.0.0 turns on it; bring it back when the release is out.

Grouped by **what you have to do first**, because that is the thing these
entries disagree on. Ten are ordinary work someone can pick up. Three are
blocked on a visual call that is not the implementer's to make. Two open with an
instruction to go measure something, because the premise is not established and
building first would be guessing.

**Each table is in the order to take it**, and a short paragraph above each says
what that order is by — so the top row is a real recommendation rather than
whichever entry was filed first. The ordering is editorial and nothing checks
it; move a row when the reason above the table stops describing it.

**One file per item, under [todo/](todo/).** Each carries the full entry as its
own doc, with `name:`/`description:` frontmatter and a `metadata.category`
matching which table below it is in. This table is the index; it does not
restate the entries, the way `ideas/README.md` does not restate its proposals.

**The index below is checked, not merely written.**
`website/scripts/check-todo-index.ts` (under `pnpm check-docs`) fails when a
file under `todo/` has no row, when a row points at a file that does not exist,
and when a row sits in a table its entry's own `category` disagrees with — it
cannot check the `Area` and `First move` columns, or the row ORDER, which are
editorial, but the half that rots is the half it covers.

## Ready to take

Ordered. The first four are checks owed on code that landed in the v5 window,
where a wrong answer means something already shipped broken and two of them run
the same gate. Then the one setting the rewrite dropped, then the two things the
docs site publishes — one of which may already be done — then the ABI baseline
this major release is the moment for, then the two halves of the
release-validation exit criterion, which rise to the top of the file the moment a
date exists.

| Item | Area | First move |
| --- | --- | --- |
| [Verify the shared rect buffer headed](todo/verify-the-shared-rectcontinuation-buffer-on-real-hardware.md) | GPU canvas | code landed; only the headed WebGL2/WebGPU check is owed, and no unit test on the Canvas2D path can see a wrong attribute offset |
| [Read the drift the AA ramp conversion predicts](todo/read-the-cross-backend-drift-the-aa-ramp-conversion-predicts.md) | shaders, GPU | all four converted; run the gate with the MSAA sample count held fixed, on a worktree with no second `runner.ts` in it |
| [Make the capture scroll-invariant](todo/make-the-snapshot-capture-scroll-invariant-then-widen-the-gate-to-webgpu.md) | browser tests | it is `snapshot.ts`, not a shader — attribution is done. Every gate script passes `--skip-webgpu` today, so webgpu ships ungated until this lands |
| [Cover a per-base colour mode in the cross-backend gate](todo/cover-a-per-base-colour-mode-in-the-cross-backend-gate.md) | alignments, browser tests | one scene per mode in the existing gate; pick a zoom where `binBp > 1`. Same gate as the row above, and this is the hole that already let a false appearance claim ship |
| [Turn the multi-sample variant tooltips off](todo/let-the-multi-sample-variant-display-turn-tooltips-off.md) | variants | a v5 regression, not a feature — the rewrite dropped `showTooltips` and only the legacy-props comment remains |
| [Re-render the settings-menu figures](todo/re-render-the-five-figures-the-settings-menu-refactor-outran.md) | figures, synteny | probably already done — verify before spending the pipeline; three need a review, not a capture |
| [Rebuild the OrthoFinder demos' chrom.sizes](todo/rebuild-the-three-orthofinder-demos-chromsizes.md) | figures, synteny | rerun the script into `demos/`, then re-render three; raise alpha only uniformly, if at all. `demos/orthofinder_*` is still at `ffa68a2e84` and the two spec-side workarounds are still carrying it |
| [Do the plugin `exports` surfaces earn a baseline](todo/do-the-session-and-plugin-exports-surfaces-earn-a-baseline.md) | plugins, ABI | the plugin-`exports` baseline is built (`products/jbrowse-web/src/pluginExportsBaseline.json`); what is left is the session one, blocked on where its record lives. A major release is the moment to take one |
| [Sample the seven remaining random release-validation units](todo/sample-the-seven-remaining-random-release-validation-units.md) | release validation, tests | read `git status` first — a worktree that ran a sweep is dirty until proven otherwise. Seven of the estimate's eight draws are outstanding, and the estimate is what says the release is safe |
| [Write the one-page spec for two more concepts](todo/write-the-one-page-spec-for-two-more-cross-cutting-concepts.md) | release validation, architecture | name the two concepts before writing either; the plan never did. Named in the exit criterion beside the sampling above |

## Blocked on a visual call

Three entries waiting on one person, which is the argument for taking them in one
sitting. All three draw something misleading today — a control nobody can read, a
bar eating its neighbour's space, and two backends disagreeing by 41% on a
display whose SVG export then disagrees with the screen it came from. The nine
open questions about what a mark should MEAN went to
[ideas/](ideas/README.md) on 2026-08-26; these three are wrong pictures rather
than unsettled ones.

| Item | Area | First move |
| --- | --- | --- |
| [Midnight primary is invisible on dark stock](todo/midnight-primary-is-invisible-on-the-dark-stock-ground.md) | palette, theme | pick one of three; never re-tint a single component. 1.18 contrast on every primary element of the stock dark theme, and the set the two `styleOverrides` hatches miss grows with each component that leaves MUI |
| [The interbase stack overruns its half-band](todo/the-interbase-stack-overruns-its-half-band-at-a-split-read-breakpoint.md) | alignments | a visual call; the overflow is measured, no fix is chosen — and it eats 50% of the coverage bars at exactly the locus someone navigates to |
| [Sub-pixel matrix rows draw 1px on the GPU and thinner on Canvas2D](todo/a-sub-pixel-matrix-row-draws-1px-on-the-gpu-and-thinner-on-canvas2d.md) | variants, backends | a visual call; the 41% is measured and neither side is obviously wrong |

## Measure first: the premise or the cost attribution is unconfirmed

Two, both cheap, and both about something v5 itself changed. The first watches
traffic a v5 feature introduced in a mode that had none; the second is the half a
stopwatch answers of a claim a release note would make. Everything else that was
here gated a build nobody has committed to, which is a proposal — those went to
[ideas/](ideas/README.md) on 2026-08-26.

| Item | Area | First move |
| --- | --- | --- |
| [Watch the per-base refetch on a real BAM](todo/watch-the-per-base-refetch-on-a-real-bam.md) | alignments, RPC | count `RenderAlignmentData` calls over a scripted zoom; don't reason about the throttle. New traffic in a mode that had none, and nobody has watched it |
| [Time a two-tier PIF to settled](todo/time-a-two-tier-pif-to-settled-in-a-browser.md) | synteny, PIF | bytes are measured; what is left wants the app and the ready gate — and the zoomed-in case, where a release note claiming a win needs the case in which there isn't one |
