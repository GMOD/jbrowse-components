---
name: config-write-surface
description: The configuration write API — `setConf` takes only a name where `getConf` takes a path, so a nested member write has no spelling and callers fabricate holders or read-modify-write. Candidate P (a path-taking `setConf`) is built, green and landable on `candidate-p`; the typed-props work underneath it is measured but not viable as spiked.
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

1. **Typed config props is not viable as spiked.** `variant-d.patch`
   (scratchpad only, not in the tree) declares the node's `Type` as a mapped
   type over the definition. Measured: no build-time cost, +2.7% `.d.ts` bytes,
   zero TS4058, and the base merge must be computed **once** in
   `ConfigurationSchema`'s return type — computing it per read costs 111
   `TS2589 excessively deep`, one per file. But it **regresses** the read-side
   check it was meant to improve: `HostChecksSlotNames<ScoreScaleHost>` reads
   `false` under it, and a whole-project typecheck is 162 errors against the 67
   `tsc --build` reports, including `AnyConfigurationSnapshot circularly
   references itself`. Two agents were working this; see
   `handoffs/typed-config-props.md` and `handoffs/config-index-signature.md` on
   their branches.
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
