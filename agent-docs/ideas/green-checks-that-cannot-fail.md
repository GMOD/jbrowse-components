---
name: green-checks-that-cannot-fail
description: Five checks in this repo passed for structural reasons rather than real ones — a compiler standing in for the memo a sabotage deleted, a census that sampled only while the page was quiet, a drift check silent because all fourteen copies were wrong identically, a branch every page rendered that no page could reach, and a geometry invariant held against a polygon the shader does not emit. The catch for each, and why the class is worth naming outside genomics.
---

# Green checks that could not have failed

A check that cannot fail is indistinguishable, from the outside, from a check
that passes. This repo has now hit five of them from five different directions,
which is enough to name the class rather than treat each as its own bug.
Audience and framing: [upstreamable-ideas](upstreamable-ideas.md).

The common shape: **something between the assertion and the code silently
supplied the property being asserted.** The catch, every time, was to sabotage
the code the check names and confirm the check goes red — not to read the check
and agree with it.

## 1. A compiler stood in for the memoization

Deleting a `memo` and re-running `pnpm test` here proves nothing, because babel
compiles every component in the test run with React Compiler, which re-supplies
the memoization. `build:esm` — what actually ships — does not. So a green
sabotage meant "the compiler covered for you," and read as "that memo was
dead."

`pnpm test-ci-no-react-compiler` is the run that sees it, and it is the only one
covering what the published build contains.
[COMPILER_TERNARY_FINDING.md](../reference/COMPILER_TERNARY_FINDING.md) has the
detail.

**Why it travels:** every project that adopted React Compiler inherited this and
almost none of them know it. The general statement is that a build-time
optimizer in the test path invalidates every performance sabotage run through
it, and the fix is a second CI job rather than a better assertion. This is the
cheapest propagation in the inventory — it is a report the React team wants.

## 2. A census that only ever looked while the page was quiet

The bring-your-own site's central claim is that its pages render zero Material
UI. `smoke.mjs` counts `Mui*`-classed elements and elements whose font came from
MUI's default theme, and the count is taken once the page is quiet.

Quiet means nothing is loading — so **a component that exists only while
something is fetching was structurally unreachable by the instrument.** The
synteny page scored zero for as long as it existed while drawing a
`MuiLinearProgress` on every single visit.

The fix was to hold the same budget at three instants rather than one: a
recorder sampling from before the page's own scripts run, the count at rest, and
the union again after a hover sweep. The third exists because the two halves had
been deferring to each other — the hover census skipped `Mui*`-classed elements
on the grounds that the other count had those by name, and that other count read
its set before a pointer had been anywhere.

**Why it travels:** any library claiming to be unopinionated about UI toolkits
can measure it this way, and the "sample while quiet" trap is the default shape
of every headless check.

## 3. Fourteen identical copies, all wrong

`check-duplication.mjs` asks two questions of a copy-pasted example site: are the
copies identical, and should the copies exist. A block appearing in three or
more files needs a written reason it is the reader's own to write.

Fourteen of fifteen `TrackRow` blocks mounted the rendering component in a bare
`contain: strict` box — the display's own stacking context — so the overlay
portal found no host node, fell back to rendering inline, and buried every
display's corner controls, colour key, loading scrim and error bar. All fourteen
were character-identical, so the drift half stayed green. The fifteenth hit the
bug, worked around it, and renamed its block, which is what kept the other
fourteen from reading as anomalous.

The repair was a third question — does a copied block omit half of a contract
the library publishes — made measurable as two DOM markers and one `closest()`
rather than a list of the chrome to look for, because such a list goes stale and
a stale list reads as a clean run.

**Why it travels:** the doctrine that examples must be complete copy-pasteable
files is correct and widely used, and this is the failure mode it creates. A
drift check over copies verifies agreement, never correctness, and agreement is
what a shared mistake produces.

## 4. A branch every page rendered and no page could reach

Every status component on that site had an arm for the "nothing has navigated
the view" state, including on the page whose entire argument for the new API
*is* that state. All eighteen engine constructions passed an initial location,
so no page could produce it. The copies agreed, the drift check was green, and
the thing being taught had no demo anywhere.

**Why it travels:** the general rule is to grep for an input that produces a case
before believing the case is demonstrated, and it applies to any docs site whose
examples are also its tests.

## 5. An invariant held against a polygon the shader does not emit

`syntenyFillPad.test.ts` asserts the one property the synteny fill shaders
cannot be unit-tested for: that the padded polygon the vertex stage emits
contains every pixel where the fragment's coverage is non-zero. It sweeps
thousands of ribbon geometries, samples hundreds of rows in each, and carries
three counterexample tests showing that pads it has rejected do crop.

It modelled the polygon as spanning exactly the ribbon, `[y(t0), y(t1)]`. The
shader emits its two rows a pixel FURTHER OUT than that, at `y = -1` and
`y = height + 1`, so vertCoverage has somewhere to ramp — and kept their x at
the blend belonging to the ribbon's ends. A quad's sides are straight in screen
y, so running them over `height + 2` px while the ribbon runs over `height`
leans them across its travel: up to a full perpendicular pixel, which is the
whole footprint. Roughly the top and bottom quarter of every slanted ribbon lost
its outer antialiasing, and a sub-pixel one lost the 1px minimum band that is
the only thing drawing it at whole-genome zoom — 11.5% of such a ribbon's total
ink. **The pad was never the thing that was wrong**, which is why the file could
sweep the pad this hard and still read zero.

The catch was to model the emitted vertices rather than the shape they are
meant to bound, i.e. to take the polygon's two rows from the same expression the
shader hands to `fillVsEmit`. A `Geometry` now carries its rows alongside its
pad, and the old spelling is a counterexample beside the three that were already
there.

**Why it travels:** a check on a rasterized invariant almost always models the
ideal shape, because that is what the property is about, while the bug lives in
the difference between the ideal shape and the primitive actually submitted. The
general rule is that a geometry check has to be built from the vertex
expressions, not from the curve they approximate — and that a sweep's breadth
says nothing about whether it is sweeping the right object.

## Publishing this

This is the most distinctive of the three general-audience groups and the
hardest to write, because each item needs its failure narrated to land. The
first two stand alone; items 3 and 4 are one post about examples-as-tests, and
item 5 stands alone for a graphics audience. Item 4
also appears in
[mobx-state-patterns-to-publish](mobx-state-patterns-to-publish.md) as the
argument for naming a lifecycle state — tell it once, from whichever goes out
first.
