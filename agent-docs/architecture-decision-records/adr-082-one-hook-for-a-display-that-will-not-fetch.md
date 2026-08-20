---
status: Accepted
summary: '`loadingSuppressed`, `svgReadyExtraTerminal` and the comparative `fetchInert` were one state under three names; the readers a display forgets are the ones outside it, so it publishes one name'
---

# ADR-082: One hook for a display that will not fetch

## Status

Accepted (2026-08-20). Same genre as
[ADR-076](adr-076-a-shared-canvas-answers-readiness-twice.md) and the `painted`
argument in `RenderLifecycleMixin`: a state whose readers live outside the
display gets one name on the display.

## Context

A display can be in a state where it deliberately fetches nothing and is showing
something else instead — sequence past base resolution, LD with the triangle
toggled off, a synteny level whose two rows are not both showing regions. Four
things need to know:

- the loading scrim (`computeLoadingTerm`), or it parks over the placeholder —
  permanently once the user has clicked cancel, since `fetchCanceled` is durable;
- the SVG export (`computeSvgReady`'s `extraTerminal`), whose `awaitSvgReady` is
  an unbounded `when`, so one such display hangs the whole view's export;
- the dev-only retry check (`makeRetryContractCheck`), which otherwise reports a
  dead Retry on a display correctly declining to load anything;
- `displaysSettled`, on the comparative side, and through it the
  `data-display-drawn` attribute the screenshot harness waits on.

The LGV foundations answered the first two with `loadingSuppressed` and
`svgReadyExtraTerminal`, and could not answer the third or fourth. The
comparative family answered all four with one hook, `fetchInert`.

## Decision

**One hook, `fetchInert`, declared on `FetchMixin` and on
`SyntenyFetchStateMixin`** — the two families compose no mixin in common, so one
name with two declaration sites is the honest shape, and the generated hook table
carries an `owner` array to say so. `loadingSuppressed` and
`svgReadyExtraTerminal` are gone.

`installComparativeFetchAutorun` now installs `makeRetryContractCheck` too, which
one name across three families is what makes possible. That family shipped a
Retry button with nothing watching it.

### The argument that was there, and why it did not hold

`LDDisplay/shared.ts` carried the counter-argument in a comment: "'not drawing a
canvas', 'not covering the body with a scrim' and 'will never fetch' are
independent axes that merely coincide here". The first of those three is real and
stays — `rendersCanvas` is a separate hook, and arc is the display that proves
it, painting no canvas while fetching on every pan. The other two are the same
question asked by two consumers, and nothing in the tree ever answered them
differently: both LGV displays that override either returned one expression for
all of them.

What the split cost is the thing hooks like this exist to prevent. A display
grows the state, says the one thing its author was looking at, and the reader
outside the display goes on believing data is coming. That had already happened
twice: the global family hard-coded `loadingSuppressed: false` for a while, so LD
could express only half its own state; and `rendersCanvas` / `svgReadyExtraTerminal`
were wired by hand while `data-display-drawn` went on publishing `"false"`
forever, which burned every `waitForDisplaysDone` on the page.

## Consequences

- 20 overridable display hooks become 18, and the one that remains has four
  readers rather than a reader each.
- A fourth reader is now a change to `fetchInert`'s docstring, not a fourth hook.
- The comparative family's retry is checked. What its gate still cannot say is
  *which* decline it meant: `prepare()` returning `undefined` covers both
  "nothing to fetch" and "not ready yet", and dotplot's bails on
  `!view.initialized`. Nothing reaches that with an outstanding `reload()` today,
  since the only Retry lives on an error banner and an error needs a fetch that
  ran — see DISPLAYCHROME.md.
- Revisit if a display ever genuinely wants the scrim while refusing to export,
  or the reverse. Neither has existed; the hook's docstring names all four
  readers so the case would be visible when written.
