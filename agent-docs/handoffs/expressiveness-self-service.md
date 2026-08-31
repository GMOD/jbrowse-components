---
name: expressiveness-self-service
description: An ordering of the parked expressiveness work under one test — when a stranger hits this with nobody to ask, what sentence do they see — waiting on the out-of-tree failure channel design, the JSON Schema emitter, and the rung-3 docs, in that order. Read before proposing expressiveness work or re-answering the ggplot2 comparison.
---

# Expressiveness as self-service

Opened 2026-08-31 from a thread that asked two questions: why JBrowse feels
limited next to ggplot2, and what to do about it given the maintainers will not
always be around to answer questions.

The first question is already answered on the record and should not be
re-derived: [reference/SESSION_SPEC_FORMAT.md](../reference/SESSION_SPEC_FORMAT.md)
(format-typed vs mark-typed, the authoring-cost comparison against Gosling and
GenomeSpy, the declined encoding block) and
[ideas/session-spec-grammar.md](../ideas/session-spec-grammar.md). The short
form: ggplot2 is thin because its language absorbed the hard part before the
plot begins; JBrowse absorbed the hard part inside the plot, so its
expressiveness strategy is shortening the ladder from config to callback to
custom display, not a grammar.

The second question reorders parked work under one test: **when a stranger hits
this with nobody to ask, what sentence do they see?** A doc answers a question
once; a check, a schema or a loud error answers it forever. The items below all
exist in `ideas/` already — what this thread adds is the ordering and the test,
and it closes when the items are picked up or the ordering is filed somewhere
permanent.

## The order, with each item's first move

- **Failures speak.** The six silent failures between a newcomer and one track
  are enumerated in [ideas/lightweight-toolkit.md](../ideas/lightweight-toolkit.md);
  each wants a sentence emitted at the point of failure, not a docs page. The
  hardest and highest-value piece is the out-of-tree channel for the stripped
  display-contract checks
  ([ideas/contract-checks-out-of-tree.md](../ideas/contract-checks-out-of-tree.md)):
  a session notification behind a developer flag, where the flag, the
  "your plugin, not your data" severity, and the can-an-admin-enable-it-in-prod
  question are the design. The check itself costs nothing.
- **One published JSON Schema.** Accepted in SESSION_SPEC_FORMAT.md's
  assessment; the first move is spelled there — a second walk of the live
  schemas in `scripts/generateConfigManifest.ts`, `$defs` discriminated on
  `type`, the `jexl:` string form admitted on every slot, served at a versioned
  URL with `$schema` in every cookbook fence. This is what lets an editor or an
  LLM answer config questions mechanically, forever.
- **Rung 3 becomes real.** The custom-display page
  ([ideas/deferred-architecture-review.md](../ideas/deferred-architecture-review.md)),
  naming the engine and exporting the view/session types, and publishing the
  display-mount contract block that fourteen of the repo's own fifteen copies
  got wrong — lightweight-toolkit's work list. The npm blocker in front of all
  of it cleared while this thread was open: `render-core`, `display-ui` and the
  other fourteen never-published packages were first-published manually on
  2026-08-31 (lightweight-toolkit finding five), so the custom-display page is
  the front of this item now.
- **The boundary shrinks and freezes.** The `SessionWithX` family still extends
  `AbstractSessionModel`, and the recorded attempt to cut the base failed with
  44 errors all in `packages/app-core`, so the fix belongs there
  (lightweight-toolkit finding two's status). Behind it, the
  which-packages-cross-the-plugin-boundary decision in
  [ideas/a-dependency-bump-is-an-abi-event.md](../ideas/a-dependency-bump-is-an-abi-event.md)
  — the class of breakage a future maintainer will be least able to diagnose.

## Out of scope for this thread

Publishing the `agent-docs/` corpus itself was raised in the same conversation
and set aside by Colin on 2026-08-31; its standing record is
[ideas/upstreamable-ideas.md](../ideas/upstreamable-ideas.md).

## Closed while this file was being written, 2026-08-31

The two items lightweight-toolkit itself called smallest landed the day this
opened, and its work list records both:

- `view.status` on all four view types — `7298f136df` adopted
  `computeViewStatus` in the dotplot and circular views, one delegating getter
  each, the estimate holding because the loading getters really were the same
  spelling in all four.
- `SessionPaletteProvider` follows `prefers-color-scheme` when given no `mode`
  — `75a5d62377`, resolved inside `useSessionPalette` so the worker-baked
  labels follow the default the same way they follow an explicit mode. The
  18-example site-mode sweep is the remainder, and it is a per-page judgement
  rather than a delete, because the copies also watch the site's own
  `data-theme` toggle.
