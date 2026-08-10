---
status: Accepted
summary: "Display readiness is a data attribute and `data-testid` no longer mutates — the `-done`/`_done` suffix was an internal convenience that never reached the published contract, and its one ergonomic advantage came back as a helper that reports which half of the wait failed"
---

# ADR-065: Display readiness is a data attribute; the `-done` suffix is not the contract

## Status

**Accepted** (2026-08-10). Written as Proposed before moving any call site,
then implemented in the same session once agreed. The counts under Consequences
are what the migration cost, not what it was estimated at — the estimate was
~162 sites in three tranches and the real figure was ~200 across ~130 files,
because the inventory that produced it counted selector *lines* and missed the
regex forms (`/-display-done$/`) and the testids passed around as values.

Related: [DISPLAYCHROME.md](../reference/DISPLAYCHROME.md) §"One element per
display" (what is emitted today, and the three testid shapes this already
replaced),
[ADR-058](adr-058-track-paint-containment-stays.md),
[ADR-009](adr-009-canvas-drawn-reliability.md) (`canvasDrawn` scope),
[website/docs/agents_capture.md](../../website/docs/agents_capture.md) (the
published contract).

## Context

Two mechanisms answer "has this display finished" and they grew in that order.

**The suffix.** `DisplayStatusChromeBase` emits
`data-testid={`${testid}${drawn ? '-done' : ''}`}` — so a display's testid
*changes value* on first paint. The two non-LGV views (synteny, dotplot) have no
chrome and spell the same idea with an underscore: `synteny_canvas_done`,
`dotplot_webgl_canvas_done`.

**The attributes.** The same element also carries `data-display-id` (stable),
`data-display-phase` (`ready`/`loading`/`error`) and `data-display-drawn`
(`true`/`false`), and `RenderCanvas` publishes `data-display-drawn` for the two
non-LGV views too. DISPLAYCHROME.md records why: `data-testid` is the *base*,
shared by every instance of a display type and mutating on paint, so it can
answer neither "which track is this" nor "has everything painted" — the first
used to need a second wrapper element emitting `display-${displayId}`, and the
second used to be a three-way union over testid shapes.

So the attributes already exist, already cover every view, and are already the
*published* contract:

- `@jbrowse/capture` exports `PENDING_DISPLAYS = '[data-display-drawn="false"]'`,
  re-exported from `@jbrowse/browser-test-utils`.
- `agents_capture.md` documents five DOM signals for third parties, all
  attributes. **Neither `-done` nor `_done` appears in it.**
- Grepping `products/jbrowse-capture/src` and `packages/browser-test-utils/src`
  for the suffixes returns three hits, all of them prose in comments. No
  published selector uses one.

The suffix is therefore **purely internal** — and internally it is still the
majority. Counted 2026-08-10:

| Where | `-done`/`_done` selector sites |
| --- | --- |
| `products/jbrowse-web/src/tests` (jest/jsdom) | 115 |
| `products/jbrowse-web/browser-tests` (puppeteer) | 40 |
| `website/scripts` figure specs | 7 |

Of the 115 jest sites, 18 are on the underscore convention. The most common
single selector is `pileup-display-done` (46).

Three costs follow from having both:

1. **Two conventions.** `memHelpers.ts:124` has to wait on
   `'[data-testid$="-done"],[data-testid$="_done"]'`. Any new "wait for
   everything" selector has the same fork to remember, and forgetting the
   underscore half is silent — it counts an unpainted synteny canvas as
   finished. That exact bug shipped once (`PENDING_DISPLAYS` named
   `synteny_canvas` and forgot dotplot).
2. **The weaker signal is the more reachable one.** `-done` is *first paint* — it
   flips on an empty canvas while the fetch is still in flight. "Is this display
   finished" is `data-display-phase`. A reader reaching for the obvious
   `[data-testid$="-done"]` gets the weaker answer without being told.
3. **A mutating testid is a surprising handle.** Every other `data-testid` in the
   tree is a stable name.

## Decision

**Make `data-testid` stable and delete the suffix convention. Readiness is only
ever a data attribute.** Concretely:

- `DisplayStatusChromeBase` emits `data-testid={testid}`, unconditionally.
- The synteny and dotplot canvases emit `synteny_canvas` /
  `dotplot_webgl_canvas`, unconditionally. They already publish
  `data-display-drawn`, so nothing is lost.
- The composite queries every consumer actually wants become named helpers,
  exported from `@jbrowse/capture` (selector strings, for puppeteer and third
  parties) and `@jbrowse/browser-test-utils` (a testing-library wrapper, for
  jest):
  - `displayPainted(base)` → `[data-testid="<base>"][data-display-drawn="true"]`
  - `displaySettled(base)` → `…[data-display-phase="ready"]`
  - `PENDING_DISPLAYS` unchanged, and `capture.ts:187` — which re-spells its
    literal rather than importing it, one module over from the definition —
    imports it. (`sessionGate.ts:189` tests `[data-display-drawn]` for
    *presence*, which is the paint-contract probe and a genuinely different
    question; it wants a name of its own, not `PENDING_DISPLAYS`.)
- `findDisplayById` in `products/jbrowse-web/src/tests/util.tsx` moves to
  `@jbrowse/browser-test-utils` beside them, since it is the same composite.

**Nothing about the published contract changes**, which is the point: the
attributes are already what `agents_capture.md` documents and what
`@jbrowse/capture` selects on. This deletes an internal second mechanism, it
does not introduce a public one.

### The one real argument against, and why a helper settles it

In jsdom, `await findByTestId('pileup-display-done')` is a *single polling wait*
for "this display type exists AND has painted". Testing-library has no composite
finder, so the naive replacement is
`await waitFor(() => container.querySelector('[data-testid="pileup-display"][data-display-drawn="true"]'))`
— longer at 115 call sites, and it loses testing-library's failure messages.

That is a real ergonomic loss and it is the reason `-done` exists. It is also
entirely recoverable: `findDisplayPainted('pileup-display')` is shorter than what
it replaces, and it can produce a better failure message than either — it can say
*which* of the two halves failed ("no display with testid X" vs "X exists but
`data-display-drawn` is false"), which neither the suffix nor a raw `waitFor`
can. The migration is mostly mechanical because 46 of the 115 are one selector.

## Rejected alternatives

**Keep both tiers, document which is which.** The smallest change: leave the
suffix, write down that `data-display-*` is the contract and `-done` is a
shorthand. Rejected because the two-convention tax (cost 1) and the
weaker-signal-is-more-reachable problem (cost 2) both survive it, and a
documented split that nothing enforces is the arrangement DISPLAYCHROME.md
already tried — "three coexisting testid shapes" was the outcome.

**Standardize the suffix on `-done` everywhere and drop `_done`.** Fixes cost 1
only, and touches the same synteny/dotplot call sites the full migration does. It
also makes the suffix look *more* like the contract, which is backwards.

**Drop the attributes, standardize on the suffix.** Not viable: a suffix cannot
carry display identity (that is what `data-display-id` is for), cannot express
the three-way phase, and is absent from the published docs and every
`@jbrowse/capture` consumer.

## Consequences

- **~162 call sites move**, in three tranches that can land separately: jest
  (115), browser-tests (40), website figure specs (7). Each tranche is
  independently verifiable — `pnpm test`, the puppeteer suites, and a figure
  regeneration diff respectively.
- **`tooLarge`/`renderError` are unchanged and still publish nothing.** The
  container is not rendered in those phases, so a too-large display matches
  neither the old suffix nor the new composite. Deliberate, and unaffected by
  this ADR — but it is why "wait for painted" can never be the *only* wait.
- **Released builds are unaffected**, and this is worth stating because it looks
  like a compatibility question and is not. `PAINT_CONTRACT_NOTE` records that
  `jbrowse.org/code/jb2/latest` publishes none of the data attributes (measured
  2026-08-07) while `main` publishes all three. `@jbrowse/capture` already
  detects which build it got and degrades to a bounded settle. Since no published
  selector uses `-done`, deleting it changes nothing about that path — a third
  party driving a released JBrowse is on the degraded path today and stays there
  until the attributes ship in a release.
- **A grep gets easier.** "What waits on paint" becomes one attribute name rather
  than an attribute plus two suffix spellings, which is also what makes a future
  audit of this contract possible.

## What would reopen this

A consumer that genuinely needs paint state encoded in a *single* attribute value
— a CSS selector context with no attribute-conjunction support, or a tool that
can only match one attribute. None exists today; both puppeteer and
testing-library take arbitrary CSS.
