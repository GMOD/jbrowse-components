---
status: Accepted
summary: "Export MST model instance types as `interface X extends Instance<…> {}`, not `type X = Instance<…>` — the interface form is what lets a view and its display name each other. Amended 2026-08-31: it does not reach a four-node cycle, where a duck on the display's `view` getter is the link instead"
---

# ADR-055: MST model instance types are interfaces, not aliases

## Status

Accepted (2026-08-04). Prompted by `DotplotDisplay` gaining a `self.view` getter
and taking the whole plugin's types down with it.

## Context

A display naturally wants to name its view (`get view()` — three exist:
`LinearSyntenyDisplay`, `DotplotDisplay`, `ChordVariantDisplay`), and a view
naturally wants to name its displays (`dotplotDisplays`, `linearSyntenyDisplays`,
`geometryByDisplayKey`). Both are ordinary, and together they are a mutual
reference between two inferred factory return types.

With the alias form on both ends:

```ts
export type DotplotDisplayModel = Instance<ReturnType<typeof stateModelFactory>>
```

TypeScript has to infer the display factory's return type to resolve the alias.
That return type contains `get view(): DotplotViewModel`, which needs the view
factory's return type, which contains `dotplotDisplays: DotplotDisplayModel[]`,
which needs the display factory's return type. The loop has no non-inferred
link, so it collapses:

```
stateModelFactory.tsx(40,17): error TS7023: 'stateModelFactory' implicitly has
  return type 'any' because it does not have a return type annotation and is
  referenced directly or indirectly in one of its return expressions.
stateModelFactory.tsx(87,11): error TS7023: 'view' implicitly has return type 'any' …
stateModelFactory.tsx(351,13): error TS2456: Type alias 'DotplotDisplayModel'
  circularly references itself.
```

**This is loud, not silent** — worth stating plainly, because the natural
assumption is that an `any` collapse types everything and says nothing. It does
the opposite: the model resolves to `any`, so every consumer that destructures
it or hands it a callback goes implicit-any, and `pnpm typecheck` reports
roughly twenty further TS7006/TS7031 errors across a dozen files that have
nothing to do with the change. That cascade *is* the diagnosis, and it is the
part that misleads — the two TS7023s scroll past and the reader starts fixing
`Parameter 'b' implicitly has an 'any' type` in `Axes.tsx`.

Explicit return annotations do not help. Annotating every getter still leaves
`DotplotDisplayModel` an alias that circularly references itself (TS2456); the
annotation defers inference, not resolution.

## Decision

**Export the instance type of an MST model as an interface:**

```ts
export interface DotplotDisplayModel
  extends Instance<ReturnType<typeof stateModelFactory>> {}
```

Interfaces are resolved lazily by design, so the mutual reference terminates.
Required for any model that participates in such a cycle; preferred generally,
since which models will grow one is not knowable in advance. `plugins/alignments`
already wrote `LinearAlignmentsDisplayModel` this way.

Applied to `DotplotDisplayModel` and `DotplotViewModel`, which is what lets
`DotplotDisplay.view` name `DotplotViewModel` the way `LinearSyntenyDisplay.view`
names its own.

### Verified, not assumed

- With the cycle present and both ends as aliases: the errors above, plus the
  implicit-any cascade.
- With the cycle present and both ends as interfaces: the repo typechecks clean.
- The recursion genuinely resolves rather than being erased — a probe asserting
  wrong types shows `display.view.dotplotDisplays` typed as
  `DotplotDisplayModel[]`, `display.view.hview.bpPerPx` as `number`, and
  `display.trackId` as `string`.
- Repo-wide audit for a latent collapse elsewhere: 56 exported model types
  across 25 packages, none resolves to `any`. The technique, if it is ever
  needed again — generate a file per package containing
  `type IsAny<T> = 0 extends 1 & T ? true : false`, `type Expect<T extends false> = T`,
  and one `Expect<IsAny<TheModel>>` per type, then typecheck. Validate the probe
  itself against a known `any` first; an unchecked file and a passing file look
  identical.

## Alternatives rejected

**Duck-type the view on the display side.** A declared `DotplotDisplayView`
slice of just what the display reads, returned by `self.view`. This works and
was the first fix, but it buys a hand-maintained parallel declaration to route
around a compiler limitation the interface form removes outright — and it
generalizes badly, since the same slice would be owed at every view↔display pair
that ever grows one. Reverted in favor of the interface form.

> **Amended 2026-08-31: the interface form does not reach a FOUR-node cycle, and
> there the duck is the fix.** Linear synteny's loop is
> view → `levels` → level → `linearSyntenyDisplays` → display → `view`, one hop
> longer than dotplot's mutual pair, and it has no non-inferred link of its own.
> Measured: with all four instance types written as
> `interface X extends Instance<…> {}` and the display's getter naming
> `LinearSyntenyViewModel`, the interfaces do not terminate — they resolve to
> nothing, and typecheck reports 28 TS2339s for members that plainly exist
> (`display.featureData`, `view.views`, `level.renderParams`). A different
> signature from the alias collapse above, and a worse one to read, since it
> names real members as missing.
>
> `LinearSyntenyDisplay.view` returns `ParentViewDuck` instead, which is the
> link the compiler needs and is a far cheaper erasure than the
> `IAnyModelType` on `levels` it replaced: it erases only what a display reads
> off its view, one list in one file, rather than everything reachable through a
> level. `levels[i]` is fully typed now — verified by a probe, per the
> "Verified, not assumed" method above — and that recovered four real defects
> the `any` had been hiding, including a test helper declaring `displayKey` a
> `string` where the model has a `number`.
>
> The rule stands for a mutual pair. Reach for the duck when the loop is longer
> and nothing on it is annotated.

**Duck-type the display on the view side.** Annotate `dotplotDisplays` with an
interface. Same trade, moved to the side with more readers: components legitimately
want the whole display model, so that slice would grow with every component.

**Erase the link with `IAnyModelType`.** What `LinearComparativeView` did
(`const LinearSyntenyLevel: IAnyModelType`), and the reason synteny's aliases
compiled: its view never structurally contains its display. The cost is that
`levels` and everything reached through them is untyped — checking traded away
across a whole subtree to break one cycle.

The interface form was expected to break the same cycle and keep the types. It
does not, on this one — see the amendment above. Erasing at the display's `view`
getter does, and that annotation is gone as of 2026-08-31.

**A compile-time `IsAny` guard file per package.** Considered because the
collapse *sounded* silent. It isn't, so a guard would add a hand-maintained list
of every model type — drifting the moment someone adds one — to re-report what
the compiler already refuses to compile.

## Consequences

- New MST models export their instance type as an interface. A `type X =
  Instance<…>` in review is a latent version of this bug, not a style nit.
- The failure signature to recognize, and its order: TS7023 on a state-model
  factory → TS2456 on the model's exported type → an implicit-any cascade in
  unrelated files. Fix the first, not the cascade.
- `interface … extends` needs a statically known object type. Every
  `Instance<…>` is one; a model type that was a union could not use this form
  (none is).
- Not retrofitted repo-wide. The two comparative pairs and alignments cover the
  models with live mutual references; the rest are converted when they grow one.
  A codemod over all 114 remaining aliases was run once to price it: 107 are
  exported and convert cleanly (whole repo typechecks, `pnpm lint` clean), but it
  touches 110 files across every plugin and both linters, so it collides with any
  concurrent work for no compile-time gain. Cost measured, decision unchanged.
- **The seven that are NOT exported must stay aliases**, and a codemod that does
  not skip them breaks the build. A function-local `type Conf = Instance<…>`
  (`assemblyManager.ts`, `DrawerWidgets.ts`) is inlined by declaration emit while
  it is an alias; as an interface it becomes a named type the emit must reference
  and cannot, giving TS4060 at the declaration and TS4058 at ~30 downstream
  re-exports. The rule is about EXPORTED model instance types only.
- Converting also makes some `as unknown as X` casts look unnecessary to
  `typescript/no-unnecessary-type-assertion`, and at least one is not:
  `HtsgetBamAdapter` needs its cast for `readConfObject`'s slot-name lookup, even
  though the two config Instance types are mutually assignable (which is all the
  rule checks). Autofixing that one stops the file compiling.
- `LinearComparativeView`'s `IAnyModelType` erasure is now removable in
  principle — it predates this and is a separate, riskier change.
