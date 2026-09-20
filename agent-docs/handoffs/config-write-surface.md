---
name: config-write-surface
description: The configuration write API — `setConf` takes only a name where `getConf` takes a path, so a nested member write has no spelling and callers fabricate holders or read-modify-write. Candidate P (a path-taking `setConf`) is built, green and landable on `candidate-p`; typed config-node props reach zero errors and a smaller .d.ts on a second branch.
---

# The configuration write surface

State on the evening of 2026-09-19. Three review fixes landed on main
(`bf29769b5b`, `86fde0cc4c`, `cfd7c23e0d`). Everything else here is on
unmerged worktree branches.

## What is ready to land

**`candidate-p`** (head `c054e4141d`, 13 files, +457/−60): `setConf` takes the
same path `getConf` takes. `setConf(self, ['scales','y','domainMin'], 5)`.
`pnpm verify --full` green including the esm build; 234 suites / 3192 tests.

It needs nothing else to land — in particular it does **not** depend on the
typed-props work below. Re-run `verify --full` before landing; the green is the
agent's measurement, not mine.

What it deletes: `ValueScaleHost` and `scaleNode` (`ScoreScaleMixin.ts:35-47`),
the `{ configuration: node }` holder at `setFaceted`, and the read-modify-write
at `setRibbonColorDomain` and `setFacetDomain`.

## The one design argument worth keeping

`setFacetField` must stay a whole-object write (a field change clears the
previous field's domain) while `setFacetDomain` becomes a member write. Under
the path spelling the two differ by a bracket, and the wrong version reads
aloud as wrong. Under the rejected node spelling
(`writeConf(self.conf.facet, 'field', f)`) the wrong version is the *more*
natural of the two and sits one character from the correct line above it —
which is the shape of the bug `86fde0cc4c` fixed.

## Decided, do not reopen without new evidence

- **`applyPatch` is not the write API.** All four claims about it verified —
  arbitrary-depth paths, protection rule satisfied from any caller,
  whole-object writes running the schema's `preProcessSnapshot` via
  reconcile-in-place, `undefined` reconciling to the default. But it carries
  neither `setSlot` guard: `/hieght` throws nothing and writes nothing, and
  with type-checking off a bad value type silently no-ops. Deleting the three
  node actions for it trades one `cloneAndEnhance` per schema type for the one
  config mistake with no diagnostic at any layer. Tests:
  `packages/core/src/configuration/applyPatchWriteSurface.test.ts` on
  `candidate-p`.
- **A member write must not run the level's `preProcessSnapshot`.** Four
  agents objected independently, for four different reasons; the load-bearing
  one is that ADR-133 considered and rejected it on the merits — moving between
  two valid channel objects one slot at a time passes through a refused one, and
  some moves have no ordering that avoids it.
- **A schema flag declaring an object atomic** (`kind: 'value' | 'record'`) —
  rejected 2:1, and ADR-133 is the record of atomicity being false.
- **`null` as the imperative channel-clear** — it makes `null`'s meaning depend
  on the slot's type. The tree already writes `{}` and it works.

## Open, in priority order

1. **Typed config props works, and dropping the index signature is what makes
   it work.** Branch `worktree-agent-ad46ed385972fe570`: `tsc --build` and a
   whole-project `tsc --noEmit` both **0 errors**, cold build 25 s (unchanged),
   `.d.ts` **1.9% smaller than main**, zero TS2883 (typescript7's TS4058).
   Typo detection is live — three `@ts-expect-error` probes in
   `configTypeNarrowing.test.ts` on an unknown slot, an unknown nested member
   and an unknown snapshot key; a clean build means they are used.

   Its error set is a strict subset of the weaker `variant-d.patch` spike's —
   60 against 67, **zero new**. So the index signature was never paying for
   itself: removing it costs nothing beyond what read narrowing already costs,
   and the ~250 contravariance failures three reviews predicted never appeared.

   Two mechanisms worth keeping. **TypeScript gives an intersection an implicit
   index signature only when every constituent is an alias or mapped type** — an
   interface constituent blocks it, and MST's `IStateTreeNode` was the
   constituent doing that. Restating the brand as an alias is what makes a
   concrete config assignable to `AnyConfigurationModel`; no clever
   redefinition of `AnyConfigurationModel` was needed. And **233 of the 342
   starting errors were TS2883 "cannot be named"**, from four helper types
   unreachable from `@jbrowse/core/configuration` — four export lines took 342
   to 60.

   `variant-d.patch` (saved beside this file) is the weaker spike and its two
   symptoms — `HostChecksSlotNames<ScoreScaleHost>` reading `false`, and 162
   whole-project errors against the 67 `tsc --build` reports — are artefacts of
   that patch, not of typed props. Both are gone on the branch above, where all
   twelve `HostChecksSlotNames` pins hold. Do not start from the patch.

   **Two branches reach zero independently and need reconciling.**
   `worktree-agent-a9c5e4188f5908d2d` (tip `49ce13e764`, `verify --full` green,
   421 suites) keeps the index signature and fixes the spike properly;
   `worktree-agent-ad46ed385972fe570` drops it and gains typo detection and a
   smaller `.d.ts`. The second is strictly more ambitious; take it as the base
   and lift the first's diagnoses into it.

   Three diagnoses from the first that the second does not state, each of which
   fails **silently**:

   - **MST declares `Type: STNValue<T, this>`.** A config node carries its own
     schema in the `IStateTreeNode` brand by polymorphic `this`, so redeclaring
     `Type` drops it, `ConfigurationSchemaForModel` degrades to
     `AnyConfigurationSchemaType`, and every read-side slot-name check switches
     off with no error anywhere. `scripts/audit-config-read-types.ts` is what
     sees it: 137 unchecked reads on main, **333** under `variant-d.patch`, 131
     after the fix. Restate `IStateTreeNode<this>` in the override. **Run that
     audit on any branch that touches the node type** — nothing else reports
     this.
   - **`& ConfigurationSchemaDefinition` on the merged definition** gives it an
     index signature, and `Omit<BD, keyof D>` over one collapses to just that,
     dropping every named base slot on every merge. 48 of the 67, plus the
     `AnyConfigurationSnapshot` circularity.
   - **Wrapping `ConfigNodeType` in an `IsAny` conditional** makes TypeScript
     measure `DEFINITION` covariant, and a failed covariant type-argument check
     is refused where an invariant one falls back to structural.

   Five latent bugs the `any` was hiding, headed by `HtsgetBamAdapter`
   registered with one schema while reading another's through a cast. Detail in
   `handoffs/typed-config-props.md` and `handoffs/config-index-signature.md` on
   the two branches.

2. **`null` as the reset token for JSON-borne routes.** No session spec, share
   link or agent call can reset a slot to its default today. Twelve
   `defaultValue: null` slots in the tree, every one already meaning "unset",
   all better typed as `maybeFrozen`. Agents split 2:1 for; the dissent is
   answered if `null` is banned as a slot value outright rather than added
   alongside. Needs Colin's call, not an experiment.
3. **Is the MST startup cost a schema-construction artefact?** The fork's
   profile says ~20k unions per session load against ~668 slot declarations.
   `createBaseTrackConfig(pluginManager)` is called once per *track type*,
   rebuilding ~35 base slot types each time. If that is it, the fix is interning
   `ConfigSlot(def)` on `(type, model, defaultValue)`, not anything
   architectural. Unmeasured — needs a quiet machine and the fork's own
   `scripts/ab-config-schema.mjs`.

## Where the working notes are

Seven agent proposals and reviews, and the spike measurements, were written to
this session's scratchpad and are not in the tree. This file and the two
handoffs named above are what survives.
