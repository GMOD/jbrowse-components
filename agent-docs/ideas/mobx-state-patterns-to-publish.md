---
name: mobx-state-patterns-to-publish
description: Two state-management patterns built and validated here that need nothing from genomics — splitting an autorun into a pure plan and an installer, and answering a lifecycle with one discriminated getter instead of N booleans every caller re-subtracts. Both have a failure story sharp enough to carry the idea, and neither has a name outside this repo.
---

# MobX patterns worth publishing

Two shapes this repo arrived at the hard way. Both are framework-level rather
than genomic, both are already load-bearing in the tree, and neither is written
anywhere a MobX user would find it. Audience and framing:
[upstreamable-ideas](upstreamable-ideas.md).

## 1. An autorun's decision and its dependency set fail in opposite ways

`planRegionFetch.ts` (278 lines) answers "given these inputs, what should
happen" as a value — a region set to fetch, an assembly mismatch, or idle with
one of five reasons. No tree, no view, no mocked RPC.
`installPerRegionFetchAutoruns.ts` (228 lines) owns what no pure function can
state: which reads MobX tracks, which are `untracked` performance guards whose
observable has a better re-trigger, and which sit behind a thunk so a run that
bails early never subscribes to the viewport.

**The reason is the transferable part.** A wrong decision is visible in any
test. A wrong dependency set leaves a body that is entirely correct and simply
never runs again — no error, no failing assertion, and the symptom appears
somewhere else entirely. One file cannot pin both, so the split is what makes
either testable.

**Thunk parameters are the plan's only statement about tracking.** Passing
`track.minimized` by value would wake every minimized track on every pan;
passing `() => track.minimized` says "read this only on the path that needs it."
That is a small, portable idea with an immediate cost when you get it wrong, and
`computeDisplayPhase` and `computeViewStatus` both take their loading term the
same way for the same reason.

Second-order result worth including: after the split, the retry classification
collapsed from seven `noteFetchAutorunRun(...)` calls scattered down the body to
one mapping over the plan's own reason.

The pattern generalizes past fetching — it applies to any MobX autorun whose
body has grown a decision. This repo now has three fetch-family installers
(`installPerRegionFetchAutoruns`, `installComparativeFetchAutorun`,
`GlobalDataDisplayMixin`'s), which is the evidence that it is a shape rather
than one refactor.

## 2. A lifecycle is one discriminated getter, not N booleans

`computeViewStatus` (`packages/core/src/util/viewStatus.ts`, 63 lines) returns
`ready | error | loading | noRegions`, with the payload travelling on the branch
so a caller cannot read a loading message out of a failed view.
`computeDisplayPhase` (`packages/render-core/src/displayPhase.ts`, 167 lines) is
the same shape one level down and came first.

**The failure story is what makes it land, and it is unusually clean.** A view
here answered its own lifecycle through nine unrelated getters — `ready`,
`error`, `initialized`, `showLoading`, `showImportForm`, `hasSomethingToShow`,
`loadingMessage`, `loadingProgress`, `assemblyErrors`. `view.ready` was
literally the subtraction `!showLoading && !this.error`, so every host
re-derived the precedence and they did not agree.

Then the sharper half: that subtraction is true when *nothing has navigated the
view yet*. A host gating on `ready` mounts its tracks over an empty view and
shows a blank box with nothing anywhere saying why. Naming that state
`noRegions` is what made it representable — and every one of the eighteen
examples on the bring-your-own site had been passing an `init` blob, so no page
could reach the state even after the arm was written for it.

**Two claims to make, in this order:** a boolean lifecycle forces every consumer
to re-encode the precedence, and the state you forgot to name is the one your
own demos cannot reach.

## What publishing these needs

Neither needs a package. Both need a name that is not the JBrowse spelling and a
post short enough to read in one sitting — the plan/installer split has the
better failure story, so lead with it. Check
[green-checks-that-cannot-fail](green-checks-that-cannot-fail.md) before
writing: the unreachable `noRegions` arm belongs to both docs and should be told
once, from whichever one goes out first.
