---
name: deferred-config-slot-reads
description: A `jexl:` config slot read with no args is no longer evaluated — it reads as its own expression (2026-08-10, three commits on worktree-jexl-feature-binding). Why the rule keys on empty `args` and not on `contextVariable`, the two live bugs it fixed and the two unrelated-looking symptoms they wore, what was measured so it is not re-derived, and the six things a reviewer should actually probe — starting with `readConfSlot`'s plain-object branch, which does not follow the rule. Read before reviewing, extending, or reverting that change.
---

# Deferred config slot reads

State as of 2026-08-10. Branch `worktree-jexl-feature-binding`, three commits on
top of `9bc26e8ebd`. Nothing pushed, nothing landed on `main`.

This is the config-reader thread. The typed repair it deliberately stops short
of is `TODO.md` §"Deferred config slots are typed as if they were resolved" and
is not duplicated here.

## The rule

`readSlot` in `packages/core/src/configuration/readConfObject.ts`: a slot whose
value is a `jexl:` callback is evaluated **only when the read supplied some
`args`**. An arg-less read returns the expression string.

`readConfObject` and `getConf` are the same read, so both follow it.

## Why it exists

`args` is an optional parameter, so `readConfObject(conf, 'color')` and
`readConfObject(conf, 'color', {feature})` are two different operations — "what
is this setting" and "what is this setting FOR this feature" — separated by
nothing a call site or a type can see. The arg-less form used to evaluate
anyway, against a context where every name in the expression is `undefined`, and
return the fallout as the setting.

Two live bugs, and the reason this took two sessions is that they look nothing
alike:

| slot | expression | arg-less read | symptom |
| --- | --- | --- | --- |
| `LinearManhattanDisplay.color` | `jexl:get(feature,…)` | throws `reading 'get'` | escapes a display model getter, banners the display |
| `LinearMultiRowFeatureDisplay.partitionField` | `jexl:split(feature.name,…)` | `''`, because `split` is total | `''` ships to the worker as an attribute name; every feature lands in one unnamed row |

Both are displays that curate `rpcProps()` slot by slot. The **wholesale**
snapshot form never had the bug: `fullConfSnapshot` reads raw MST properties and
never touches the reader, which is why canvas/wiggle were fine. This only brings
the slot-at-a-time read into line with it.

`LinearBasicDisplay` (`featureColor`, `utrColor`, `colorByMode`) and
`renderConfig.ts` (`featureHeight` typed `number | string`) had each already
worked around this locally — four hand-written guards before anyone looked at
the reader.

## The rejected alternative, so it is not re-proposed

**Keying on the slot's `contextVariable` declaration.** It is more precise — it
would also catch a read that passes the wrong context, which emptiness does not
— and it was written, tested, and backed out.

`contextVariable` is config-editor metadata: it gates `SlotEditor`'s
value/callback toggle and names the variables in the callback editor's help.
Nothing in the read path consulted it. Promoting it to a correctness invariant
means a slot that forgets to declare one silently reverts to the old behaviour —
and `partitionField` had forgotten, which is *how it shipped broken*. Emptiness
requires nothing to be declared and nothing to be maintained.

`partitionField` gained `contextVariable: ['feature']` in the same commit, for
the editor's sake only. The fix does not depend on it; `deferredSlotRead.test.ts`
asserts the rule holds on a schema that declares none.

## Measured — do not re-derive

- **Both canaries fail without the core commit and pass with it.** Verified by
  stashing `readConfObject.ts` alone and re-running:
  `plugins/gwas/src/LinearManhattanDisplay/colorSlotTransport.test.ts`,
  `plugins/canvas/src/LinearMultiRowFeatureDisplay/partitionFieldTransport.test.ts`.
  Neither display needed a code change — the per-display fixes started in the
  first pass were reverted so the canaries test the rule, not a workaround.
- **`packages` + `plugins`: 1112 suites, 11312 tests, green.** Repo
  `tsc --noEmit` clean.
- **Only one recorded behaviour changed**: `configTypeNarrowing.test.ts` asserted
  `jexl:1+1` on a `number` slot reads as `2`. It now reads as `"jexl:1+1"`. That
  assertion is where the old behaviour is easiest to see for what it was — type
  laundering, manufacturing a number so the declared type stayed superficially
  true whether or not the number meant anything.
- **The three `ExportSvg` golden failures in `products` are pre-existing.** They
  fail identically with the commit stashed, and the rendered SVG is byte-identical
  either way. Refreshed separately (`188a479389`) after rasterizing and pixel-
  comparing: 0 differing pixels at 3-4x, `<text>` count unchanged at 37; what
  went away was offscreen elements and the empty `<g></g>` wrappers `42267917ca`
  stopped emitting.
- **The `products` suite flakes under parallel load**, not because of this
  change: two full runs of the same tree gave 8 and 20 failed suites. Every
  suite that touches config reads (`Manhattan`, `BigWigColor`, `JBrowse`,
  `BasicLinearGenomeView`, `Alignments`, `VariantVocabulary`) passes when run
  with `-w 1`/`-w 2`. Judge it scoped.
- **The Arabidopsis repeat lane now works and is worse.** The class partition
  renders (`LTR` / `Low_complexity` / `Simple_repeat`), and it costs the lane the
  per-feature label `META1_LTR#LTR/Copia` that the figure's "LTR/Copia
  transposon" callout points at, plus 40px and an empty row. Reverted to the
  length filter; figure regenerated and byte-identical to the published one
  (sha256 `acbc383a1a56…`). Both halves are in the spec comment — don't re-walk
  either.

## What to check

Roughly in order of how likely each is to change the verdict.

1. **`readConfSlot`'s plain-object branch does not follow the rule**, and this is
   the one real inconsistency the change introduces. `readConfObject.ts` ~line
   303: the `isStateTreeNode` branch delegates to `readConfObject` and so obeys
   the rule; the plain branch calls `evaluateJexl(value, args, jexl)`
   unconditionally. So `readConfSlot(x, 'color')` returns an expression when `x`
   is a live node and throws (or evaluates against nothing) when `x` is a plain
   object — from a function whose entire purpose is to hide that difference.

   Left alone deliberately, because it is a decision and not a slip: the only
   production caller (`packages/product-core/src/ui/util.ts:77`) passes
   `{ config: conf }`, so no shipped path hits it; and the plain branch's
   `no jexl instance provided` throw is a genuine diagnostic the rule would
   silence. Two tests pin the current behaviour
   (`readConfSlot.test.ts:25` expects `3`, `:48` expects the throw) and both use
   `jexl:1+2` — a context-free expression, i.e. the same degenerate case as the
   `configTypeNarrowing` one. **Decide it, don't inherit it.**

2. **The residual hole: some args, but not the right ones.** Emptiness is the
   signal, so `readConfObject(conf, 'color', { refName })` on a `feature`
   callback still evaluates against a context missing `feature`, exactly as
   before. Asserted, not hidden, in `deferredSlotRead.test.ts` §"what the rule
   does not cover". The audit found no such call site, but it was a grep over
   the slots that declare `contextVariable` plus their readers — a more thorough
   sweep is worth doing, and it is the case the rejected `contextVariable` rule
   would have caught.

3. **Context-free callbacks in real configs.** `jexl:1+1` on a slot, read
   arg-less, used to produce a number and now produces a string. Nothing in the
   repo does this outside the two tests named above, but `demos/*/config.json`,
   `test_data/`, and any published config are the places to look. If a real one
   exists, the rule needs a carve-out or the config needs fixing.

4. **Main-thread consumers that now receive a `jexl:` string and don't guard.**
   The audit checked reads of every slot declaring `contextVariable` and found
   the four existing `isJexl` guards plus the two bugs. It was grep-driven, so
   the method is the thing to check, not just the conclusion. A consumer that
   previously got a plausible wrong value and now gets `"jexl:…"` is *usually*
   better off — but not if it does arithmetic and propagates `NaN` somewhere
   quiet.

5. **Plugin ABI.** `@jbrowse/core/configuration` is in `ReExports/modules.ts`,
   so this changes `readConfObject`/`getConf` **semantics** for third-party
   plugins. `abiBaseline.json` guards names, not behaviour, so nothing failed and
   nothing would. Whether that needs a release note or a deprecation path is not
   a decision this session could make.

6. **Whether the floor is worth having on its own.** It converts a display-killing
   throw and a silent wrong value into a visible expression, but it leaves the
   call site unable to say which of the reader's two jobs it wants — so a read
   that means "resolve this" and forgets its feature now gets an expression
   instead of nonsense. Better failure, same ambiguity. If the typed split in
   `TODO.md` is going to happen soon, some of this becomes scaffolding.

## Not covered by the rule, by construction

- `readConfigValue` (the plain-object worker reader) always takes a `feature`
  explicitly — the bug cannot occur there, and there is no schema to consult.
- `fullConfSnapshot` / `getConfigSnapshotWithPromotables` never evaluated
  anything; raw property reads, expressions forwarded intact.
- `readConfObject(conf)` with no `slotPath` returns the snapshot and never
  evaluated. Asserted so the two paths cannot drift on what a stored callback
  reads as.
- `configurationSlot.ts`'s `toFixedValue` evaluates a callback with no context on
  purpose (converting a callback to a fixed value in the editor). It does not go
  through `readConfObject` and is untouched.

## Where the prose lives

`packages/core/src/configuration/CLAUDE.md` §"A callback read with no context is
not an evaluation" carries the rule and the don't-make-it-throw warning;
`reference/CONFIG_PATTERN.md` §"Forwarding a callback slot" carries the
wholesale-vs-curated distinction and the two-symptom table.

**Delete this handoff when the thread closes.** If item 1 is decided and items
2-5 come back clean, what survives belongs in `CONFIG_PATTERN.md`, not here.
