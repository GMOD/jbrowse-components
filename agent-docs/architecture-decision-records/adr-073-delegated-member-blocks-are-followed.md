---
status: Accepted
summary: "A model's `.views(sharedViews)` link is followed to the declaration behind it, so a model file can be split by MEMBER and not only by member BODY — and a block the generator cannot follow is fatal rather than silent"
---

# ADR-073: A delegated member block is followed to its declaration

## Status

Accepted (2026-08-17). Prompted by a spike that moved 32 config-slot getters out
of `LinearAlignmentsDisplay`'s model chain, typechecked green, and deleted 33
rows from two generated pages.

## Context

`website/scripts/api-docs/generateStateModelDocs.ts` buckets members by
`obj.filename` and renders the bucket belonging to the file carrying the
`#stateModel` tag. `withHeaders` then drops every bucket with no header — a
plain `.filter(Boolean)`, no warning. So a `#getter` written in any other file
was extracted and then discarded, and the page simply had fewer rows than the
model had members.

That set the shape of every display model in the tree. Two extractions were
possible and one was not:

- Moving a getter's **body** to a sibling module was free, because the thin
  getter stays in the chain carrying the docstring. `lanes.ts`,
  `overlaySections.ts`, `readLookup.ts`, `groupLayout.ts` and the rest of
  `LinearAlignmentsDisplay`'s siblings are all this, and it is why that model is
  a chain of thin getters rather than a chain of algorithms.
- Moving members into a **composed mixin** was free too, because the generator
  already resolves `types.compose(...)` and renders an inherited member with a
  link back to the model that declares it.
- Moving the **members themselves** to a sibling module was not, and nothing
  said so.

The consequence was that a model file's floor was its member count, whatever the
members were. Measured across the 21 display model files: **252 members — 138
getters and 114 setters — whose entire body is `getConf` / `resolveConf` /
`makePin` / `setConf`, occupying 1,485 of 19,965 lines.** In
`LinearAlignmentsDisplay/model.ts` alone that is 478 of 3,982. None of it reads
the model; all of it reads `self.configuration`. It could not leave, and the
reason had nothing to do with MST or TypeScript.

The measurement that fixed the diagnosis: the spike moved one
`.views(self => ({…}))` block of config-slot getters to `configSlotViews.ts`,
reduced the chain to `.views(configSlotViews)`, and `pnpm typecheck:web` was
green. `pnpm autogen` then deleted 33 rows from `LinearAlignmentsDisplay.md` and
`LGVSyntenyDisplay.md`. TypeScript and MST were both content; only the docs
generator objected, and only by omission.

## Decision

**Follow a member-block argument that names a declaration instead of writing the
object inline.** `.views(sharedViews)`, `.actions(sharedActions)` and the
`.volatile(() => CONSTANTS)` shape resolve to the object literal behind them,
and their members are emitted against the *model's* filename — the key the
`#stateModel` header sits on.

Three properties make the follow safe to rely on:

- **Members land in chain position.** They are emitted where the walk reaches
  the argument, not where it reaches the call. A model page's tables are in
  source order, and a block hoisted to the front of one reads as a different
  model.
- **A shared block reached by two models lands on both pages**, the same way a
  composed mixin's members do.
- **A block reached from inside its own file is emitted once.** Only the tag
  pass sees such a block today (`enclosingMemberBlock` cannot climb from a
  standalone `const localViews = () => ({…})` to a chain call), so the follow
  takes exactly the untagged members there and leaves the tagged ones to it.

**A named block the generator cannot resolve is fatal.** The count is zero
across the repo and the fix is local — point the call at a directly-named
callback, or write the block inline. Same reasoning as `assertNoUntaggedSlots`:
what it prevents is entirely silent, and a warning fails nothing. An *inline*
callback the structural pass merely finds nothing in keeps its existing
non-fatal treatment, because there is no named declaration to point an author
at.

**A member tag no model claims is a coverage-gap line.** `withHeaders` dropping
a headerless bucket is now visible in `coverage-gaps.txt` rather than invisible.
Reported rather than fatal because the count is *not* zero: it found 22 on the
first run, including ten `SequenceFeatureDetails` members that render on no page
at all, and `extendViewType` augmentations that tag members onto a model another
plugin owns — a real shape this generator has no page for.

## Consequences

The parked spike landed unchanged and both pages regenerate **byte-identical to
before the move**. That is the acceptance test: the same diff that used to cost
33 rows now costs none.

The Context figures are the measurement that motivated the decision, so they
stay as they were taken. Spending against them started immediately, and a reader
re-running the count will get a smaller number: the alignments extraction took
`model.ts` from 3,982 lines to 3,756, `TreeSidebarMixin` took the three tree
toggles and their setters off four displays, and `LegendMixin` took the
`showLegend` triple off six — 41 slot members between them, leaving **211
members / 1,261 lines** across the family.

Those two are mixins rather than delegated blocks, and that is the split the
decision draws: shared members go to a mixin, which `types.compose` already
carried; the delegated block is for what one model keeps elsewhere for size.

**What this does and does not license.** It makes a model file splittable by
member, which is a mechanical lever on the lines above. It does not make
splitting a good idea by itself — a getter that reads any *other* model member
still belongs in the chain, where `self` is the model so far, and that line is
what keeps `configSlotViews.ts` honest (`collapseGroupRows` and `showOutline`
are slot reads that stayed behind because they read `canCollapseGroupRows` and
`isChainMode`).

**Shared members still belong in a mixin, not in a delegated block.** The follow
and `types.compose` now both preserve the docs, so the choice between them is
about what the members *are*: a concern several displays share is a mixin, which
states the sharing in the type and gives the reader one page to go to; a block
one model happens to keep elsewhere for size is a delegation. Reaching for a
delegated block to share members across displays would get the docs right and
the architecture wrong.
