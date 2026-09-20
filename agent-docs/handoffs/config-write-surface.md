---
name: config-write-surface
description: The configuration write API — `setConf` takes the path `getConf` takes and a config node's props come off the schema definition, both landed. Two questions are left open, and the first of them needs Colin rather than an experiment.
---

# The configuration write surface

State on the evening of 2026-09-19. Both code threads landed; what is left is
the two questions below.

## What landed

**A path-taking `setConf`** (`21e079b9a9..f972b07c30`):
`setConf(self, ['scales','y','domainMin'], 5)`, the same path `getConf` takes,
and it takes a config node as well as a model with a `.configuration` member. It
deleted `ValueScaleHost` and `scaleNode` in `ScoreScaleMixin.ts`, the
`{ configuration: node }` holder at `setFaceted`, and the read-modify-write at
`setRibbonColorDomain` and `setFacetDomain`.

**Typed config-node props**, ADR-145, which is also the record of the two
branches this thread ran in parallel and what each knew. The reconciliation the
earlier revision of this file called for is done: the branch that kept the index
signature was the base, for its checked adapter registry and five latent fixes,
and the other's typed-props core went on top. 131 unchecked config reads → 121,
`.d.ts` −1.8%, zero errors either way.

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

1. **`null` as the reset token for JSON-borne routes.** No session spec, share
   link or agent call can reset a slot to its default today. Twelve
   `defaultValue: null` slots in the tree, every one already meaning "unset",
   all better typed as `maybeFrozen`. Agents split 2:1 for; the dissent is
   answered if `null` is banned as a slot value outright rather than added
   alongside. Needs Colin's call, not an experiment.
2. **Is the MST startup cost a schema-construction artefact?** The fork's
   profile says ~20k unions per session load against ~668 slot declarations.
   `createBaseTrackConfig(pluginManager)` is called once per *track type*,
   rebuilding ~35 base slot types each time. If that is it, the fix is interning
   `ConfigSlot(def)` on `(type, model, defaultValue)`, not anything
   architectural. Unmeasured — needs a quiet machine and the A/B config-schema
   harness under the fork checkout's own scripts directory.

## Where the working notes are

Seven agent proposals and reviews, and the spike measurements, were written to a
scratchpad and are not in the tree. ADR-145 and this file are what survives.
