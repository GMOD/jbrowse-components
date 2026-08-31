---
name: expressiveness-self-service
description: An ordering of the parked expressiveness work under one test — when a stranger hits this with nobody to ask, what sentence do they see. The out-of-tree failure channel is built; what is left is the six silent failures, one published JSON Schema, and the rung-3 docs, in that order. Read before proposing expressiveness work or re-answering the ggplot2 comparison.
---

# Expressiveness as self-service

From a 2026-08-31 thread that asked two questions: why JBrowse feels limited
next to ggplot2, and what to do about it given the maintainers will not always
be around to answer questions.

**The first question is answered on the record and should not be re-derived**:
[reference/SESSION_SPEC_FORMAT.md](../reference/SESSION_SPEC_FORMAT.md)
(format-typed vs mark-typed, the authoring-cost comparison against Gosling and
GenomeSpy, the declined encoding block) and
[session-spec-grammar.md](session-spec-grammar.md). The short form: ggplot2 is
thin because its language absorbed the hard part before the plot begins;
JBrowse absorbed the hard part inside the plot, so its expressiveness strategy
is shortening the ladder from config to callback to custom display, not a
grammar.

The second question is what this file is: an ordering over work that is already
parked one-per-file, under one test. **When a stranger hits this with nobody to
ask, what sentence do they see?** A doc answers a question once; a check, a
schema or a loud error answers it forever — so the ranking is by how permanently
each item answers, not by how much of it there is.

## The order, with each item's first move

- **Failures speak.** The six silent failures between a newcomer and one track
  are enumerated in [lightweight-toolkit.md](lightweight-toolkit.md); each wants
  a sentence emitted at the point of failure, not a docs page. **Four of the six
  are runtime states something could report** — the display-mount contract, the
  empty box `view.ready` leaves behind when an assembly 404s, a width nobody
  pushed into the model, `PaletteProvider` mounted where `SessionPaletteProvider`
  was meant — which is the shape the contract channel above already answers, one
  at a time. The other two are discovery rather than failure (three nouns before
  one pixel, four hops from view to drawn track) and want a name, not a message.
- **One published JSON Schema.** Accepted in SESSION_SPEC_FORMAT.md's
  assessment; the first move is spelled there — a second walk of the live
  schemas in `scripts/generateConfigManifest.ts`, `$defs` discriminated on
  `type`, the `jexl:` string form admitted on every slot, served at a versioned
  URL with `$schema` in every cookbook fence. This is what lets an editor or an
  LLM answer config questions mechanically, forever, and it is the parity item
  the manuscript's comparison names.
- **Rung 3 becomes real.** The custom-display page
  ([deferred-architecture-review.md](deferred-architecture-review.md)), naming
  the engine and exporting the view/session types, and publishing the
  display-mount contract block that fourteen of the repo's own fifteen copies
  got wrong — lightweight-toolkit's work list. The npm blocker cleared on
  2026-08-31 (`render-core`, `display-ui` and fourteen other never-published
  packages were first-published manually), so the page is the front of this
  item now.
- **The boundary shrinks and freezes.** The `SessionWithX` family still extends
  `AbstractSessionModel`, and the recorded attempt to cut the base failed with
  44 errors all in `packages/app-core`, so the fix belongs there
  (lightweight-toolkit finding two's status). Behind it, the
  which-packages-cross-the-plugin-boundary decision in
  [a-dependency-bump-is-an-abi-event.md](a-dependency-bump-is-an-abi-event.md)
  — the class of breakage a future maintainer will be least able to diagnose.

## Built, so don't re-propose it

The item this ordering called hardest and highest-value is the out-of-tree
channel for the display-contract checks, and it landed 2026-08-31.
[reference/ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)
§"Ordering is the contract" is the record and
`website/docs/developer_guides/testing_plugins.md` §"Developer mode" is what a
plugin author reads. Three things about the answer are worth keeping, because
the reasoning does not survive in a diff:

- **A flag a stranger must first hear about is the same silence in a different
  place.** So the arming path that matters is the one nobody has to know about:
  a plugin served from `localhost` into a production build can only be a plugin
  under development. `localStorage.jbrowseDeveloperMode` covers an author on a
  deployment they do not own, and the config slot covers a site running one
  deliberately — both are the fallback, not the headline.
- **The severity is `warning`, not a fifth notification level.** An error
  snackbar in this app means the user's data or their request failed, and every
  word of these messages is about code. What says "your plugin, not your data"
  is the notice's first sentence plus the reason it quotes for being shown at
  all: a notification in an app the reader did not build has to answer "why am I
  seeing this" or it reads as the app being broken.
- **An admin can turn it on in production, by config only.** It is deliberately
  not in the Preferences dialog — a reader who cannot change the code cannot act
  on one of these, so a user-facing toggle would offer a choice with no
  consequence.

## Out of scope

Publishing the `agent-docs/` corpus itself was raised in the same conversation
and set aside by Colin on 2026-08-31; its standing record is
[upstreamable-ideas.md](upstreamable-ideas.md).
