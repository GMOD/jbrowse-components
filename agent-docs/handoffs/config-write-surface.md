---
name: config-write-surface
description: The configuration write API — `setConf` now takes the path `getConf` takes, landed at `f972b07c30`. What remains is reconciling two typed-config-node-props branches that both reach zero errors; the read-type audit says they compose rather than compete.
---

# The configuration write surface

State on the evening of 2026-09-19, after `candidate-p` landed.

## What landed

**A path-taking `setConf`** (`21e079b9a9..f972b07c30`, 13 files, +457/−60):
`setConf(self, ['scales','y','domainMin'], 5)`, the same path `getConf` takes,
and it takes a config node as well as a model with a `.configuration` member.
Re-measured before the fast-forward: `pnpm verify --full` green including the
esm build, and `pnpm test-related` 1165 suites / 12566 tests green.

It deleted `ValueScaleHost` and `scaleNode` in `ScoreScaleMixin.ts`, the
`{ configuration: node }` holder at `setFaceted`, and the read-modify-write at
`setRibbonColorDomain` and `setFacetDomain`. Both typed-props branches below
predate that, and both carry their own `ScoreScaleMixin.ts` edit against the
deleted code — take main's side of that file when rebasing either one.

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
  config mistake with no diagnostic at any layer. The 14 tests that show it are
  an `applyPatchWriteSurface` suite beside the configuration package, on
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

   **Two branches reach zero independently, and they compose rather than
   compete.** `worktree-agent-a9c5e4188f5908d2d` (tip `49ce13e764`,
   `verify --full` green, 421 suites) keeps the index signature;
   `worktree-agent-ad46ed385972fe570` (tip `f66c869f81`) drops it and gains typo
   detection and a 1.9% smaller `.d.ts`. An earlier revision of this file said
   the second is strictly more ambitious and named three diagnoses it lacked.
   **Both halves of that are wrong**, and the correction is below.

   All three diagnoses are already on the second branch, in its own words:
   `ConfigNodeBrand<this>` restates the polymorphic-`this` brand as a type
   alias, `MergeConfigDef` is a flat mapped type over `keyof BD | keyof D` with
   no `& ConfigurationSchemaDefinition`, and the `out DEFINITION` annotation
   carries the covariance the `IsAny` wrapper would have cost.

   `scripts/audit-config-read-types.ts`, run on all three trees on 2026-09-19,
   is what settles it. **main 131, `ad46…` 131, `a9c5…` 124.** So dropping the
   index signature costs no read checking at all — the brand survives as an
   alias — and the 137 in the earlier revision is the stale committed baseline,
   not a measurement of main. Re-baseline whenever this lands: `--write` also
   rewrites two measurement JSONs that generators read, so `pnpm autogen` goes
   in the same commit.

   What the first branch has and the second does not is **real code, not
   diagnoses**, and it is why it should be the base:

   - The **adapter registry pairs a class with its schema**.
     `AdapterType<SCHEMA>` and `TextSearchAdapterType<SCHEMA>` are generic and
     `getAdapterClass` must hand back an `AdapterClassFor<SCHEMA>`, which took
     44 errors to 1 and made the 1 a real bug. The second branch widens
     `AnyAdapter`'s construct parameter to `config: any` instead — 43 errors for
     one line, and the pairing goes unchecked.
   - **Five latent bugs**, headed by `HtsgetBamAdapter` registered with one
     schema while reading another's through a cast. The second branch leaves
     that one open and carries two `as never` casts in the htsget tests because
     of it.
   - `WarningSource.parentTrack.configuration` stays `BaseTrackConfig` there,
     because `ReferenceSeqTrackConfigModel` gives
     `LinearReferenceSequenceDisplay` a schema to name. The second branch widens
     it back to `AnyConfigurationModel`, which is part of its 131 against 124.
   - **Jest and lint have never run on the second branch** — every commit on it
     is `SKIP_LINT=1`, and its worktree's jest dies on a missing `babel-jest`.

   So: base on `a9c5…`, graft the second's typed-props core onto it
   (`ConfigNodeProps` / `ConfigNodeMembers` / `ConfigNodeBrand`,
   `NormalizeSlotDef`, the flat `MergeConfigDef`, the identifier folded into the
   definition as `IdentifierSlotDef`, the index signature moved onto
   `AnyConfigurationModel`, and the four `export type` lines that take TS2883 to
   zero), keep the checked adapter registry, and re-measure all four numbers.
   Detail in `handoffs/typed-config-props.md` and
   `handoffs/config-index-signature.md` on the two branches.

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
   architectural. Unmeasured — needs a quiet machine and the A/B config-schema
   harness under the fork checkout's own scripts directory.

## Where the working notes are

Seven agent proposals and reviews, and the spike measurements, were written to
this session's scratchpad and are not in the tree. This file and the two
handoffs named above are what survives.
