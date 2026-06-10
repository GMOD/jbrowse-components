# Scope: typed config reads for state models (ConfigurationReference)

Goal: make `getConf(self, 'slot')` / `readConfObject(self.configuration, 'slot')`
in state models (displays, tracks, internet accounts) return the slot's typed
value instead of `any` — the same win adapters already get via
`BaseAdapter<CONF>`. `OAuthInternetAccount` is the worked example (7 scalar
slots, each currently carrying a load-bearing `: string`/`: boolean` getter
annotation that exists only because the read is `any`).

**Conclusion up front: there is a clean, cast-free, no-core-change solution — a
typed `conf` getter on the model (see "Solution" below). The two erasure layers
analyzed here explain why naive approaches (fixing `ConfigurationReference`,
recovering the schema from the instance brand) do NOT work; the getter sidesteps
both. Implemented as a proving ground in the three internet-account models
(OAuth/ExternalToken/HTTPBasic).** All findings verified empirically with
`never`-probes and tsgo.

## Solution (clean, implemented)

Add one typed getter per model that re-exposes `self.configuration` at its known
concrete type; route reads through it:

```ts
const factory = (configSchema: OAuthInternetAccountConfigModel) =>
  Base.props({ configuration: ConfigurationReference(configSchema) })
    .views(self => ({
      get conf(): OAuthInternetAccountConfig { // = Instance<typeof configSchema>
        return self.configuration              // no cast — assignable (see below)
      },
    }))
    .views(self => ({
      get authEndpoint() { return readConfObject(self.conf, 'authEndpoint') }, // : string
      get responseType() {
        return readConfObject(self.conf, 'responseType') as 'token' | 'code'   // stringEnum widens
      },
    }))
```

Why it's cast-free and correct:
- `self.configuration` is erased (double-branded — see Layer 2), but that
  double-branded type **is assignable** to the single-branded concrete
  `Instance<typeof configSchema>` (it has *more* brands, so it's a subtype).
  Verified: `const x: Instance<typeof Schema> = self.configuration` compiles.
- Reads off the typed `self.conf` then behave exactly like the adapter pattern:
  `readConfObject(self.conf, 'scalarSlot')` returns the slot's typed value and an
  invalid slot name is a compile error (validated against the **full** schema,
  inherited `baseConfiguration` slots included).
- The getter return annotation is the *only* type assertion, and it's honest:
  at runtime `self.configuration` always resolves to that config node. It's the
  same "declare the concrete type the framework erased" move as `BaseAdapter<CONF>`,
  not an `as` cast.
- `no-unsafe-return` is off in this repo, so returning the erased (`any`)
  `self.configuration` from the typed getter is lint-clean.

Requirement to generalize: the factory's `configSchema` param must be
**concretely typed** (internet accounts already are:
`configSchema: OAuthInternetAccountConfigModel`). Display factories currently
take `configSchema: AnyConfigurationSchemaType` — to get the same win there, that
param must first be tightened to the concrete schema model type. With a generic
`AnyConfigurationSchemaType` param, `Instance<typeof configSchema>` is
`AnyConfigurationModel` and reads stay `any`.

Stringenum slots still need a localized `as TheUnion` at the getter (the slot's
`defaultValue` widens to `string`); scalar `string`/`number`/`boolean` slots need
no annotation and the old `: string` getter annotations come off.

---

## Why the obvious approaches fail (kept for the record)

## The two erasure layers

A read off `self.configuration` is `any` for two independent reasons. Fixing one
does not help until the other is also fixed.

### Layer 1 — `ConfigurationReference` return-type erasure (FIXABLE)

`ConfigurationReference(schema)` infers its return type from three branches. Two
of them (`TrackConfigurationReference`, `DisplayConfigurationReference`) take
`IAnyType` and return loosely-typed `types.union(...)`, so the inferred return
type of the whole function is polluted — `self.configuration` is `any` at all 29
call sites, even the plain InternetAccount branch.

This part is fixable. Pinning an explicit return type whose **instance** param is
`Instance<SCHEMATYPE>` keeps `packages/core` compiling clean (0 errors):

```ts
export interface IConfigurationReference<S extends AnyConfigurationSchemaType>
  extends IType<
    ReferenceIdentifier | SnapshotIn<S> | undefined, // create: id OR inline snapshot
    ReferenceIdentifier | SnapshotIn<S>,             // snapshot out
    Instance<S>                                       // instance: concrete config node
  > {}
```

Pinning the instance param (rather than letting the union infer it) also avoids a
second trap: the config model's creation type is `{...} | undefined` (all slots
optional), and the raw union leaks that `| undefined` into the **instance**
position, producing `self.configuration: Config | undefined` and ~17 "possibly
undefined" errors in core. Pinning the instance param removes that noise.

With Layer 1 fixed, `self.configuration` stops being `any` — but reads off it are
**still `any`** because of:

### Layer 2 — config instances aren't branded with their `DEFINITION` (THE BLOCKER)

`getConf`/`readConfObject` recover a config's schema via
`ConfigurationSchemaForModel<MODEL> = MODEL extends IStateTreeNode<infer SCHEMA> ? SCHEMA : never`,
then read the slot type from that schema's `DEFINITION`. This works for the
**adapter pattern** (`this.config: Instance<typeof Schema>`):

```
ConfigurationSchemaForModel<Instance<typeof Schema>>
  => ConfigurationSchemaType<{ myScalar: {...} }, ...>   // DEFINITION recovered -> string
```

But it does **not** work off a model's `.configuration` prop, even with Layer 1's
`Instance<S>` pinning:

```
ConfigurationSchemaForModel<Instance<typeof M>['configuration']>  => any
```

Root cause: `makeConfigurationSchemaModel` builds the runtime MST model from a
`const modelDefinition: Record<string, any>` (configurationSchema.ts:96) and calls
`types.model(name, modelDefinition)`. So the **instance** is branded
`IStateTreeNode<modelWithRecord<string,any>Props>` — the `DEFINITION` survives
only on the *outer* `ConfigurationSchemaType<DEFINITION>` interface, not on the
instance. Passing through `types.reference` → `types.union` → `types.model` prop
also intersects a *second* `IStateTreeNode` brand (the reference's own node
identity), and `infer SCHEMA` over a double-branded intersection collapses to
`any`.

Verified: `ConfigurationSchemaForModel<PropInstance>` = `any` (not the schema,
not `never`); `ConfigurationSlotValue<any, 'myScalar'>` = `any`.

`Instance<typeof Schema>` works only because the *outer* interface brand carries
`DEFINITION`; nothing that flows through a `types.model` property keeps it.

## Why this isn't a bounded migration

Layer 2 can't be fixed by typing call sites or the `ConfigurationReference`
signature. The options are:

- **Preserve `DEFINITION` in the instance brand** — `makeConfigurationSchemaModel`
  would need to build a typed `modelDefinition` (not `Record<string, any>`) so the
  generated model's instance brand carries per-slot types, and the
  reference/prop branding would need to stop intersecting a second
  `IStateTreeNode`. This is deep work in core (and likely the `@jbrowse/mobx-state-tree`
  fork's reference/model instance typing), with broad and uncertain fallout.
- **Redesign `ConfigurationSchemaForModel`** to recover `DEFINITION` from
  something other than the single-brand `infer SCHEMA` — fragile, and there's no
  reliable carrier on the instance today.

The original plan (`CONFIG_TYPED_READS_NEXT_STEPS.md`) deferred displays/models
assuming this was unsolvable without that deep work. The `conf`-getter solution
above shows it is solvable cleanly after all — the assignability of the
double-branded instance to the concrete `Instance<typeof Schema>` is the loophole
that avoids needing to recover the schema from the (pathological) instance brand.

### Dead end: brand-filtering recovery

One tempting "fix Layer 2 in core" idea is to make `ConfigurationSchemaForModel`
robust to the double brand by filtering `any` out of the
`$__mstStateTreeNodeType__` union and keeping the
`AnyConfigurationSchemaType`-satisfying member. **Do not pursue this** — it was
tested and is **non-deterministic**: the same recovery type yielded `string` in
one context and `any` in a slightly different one (and flipped for the direct vs
prop case between runs). TypeScript resolves these `[any]`-laden
intersection-of-union brands inconsistently. A clean, stable solution must avoid
brand recovery entirely, which the `conf` getter does.

### Layer 1 (`ConfigurationReference` return type) is not needed

Fixing `ConfigurationReference`'s return type so `self.configuration` is concrete
(rather than `any`) is real and keeps core at 0 errors, but it delivers **no
typed slot reads on its own** (Layer 2 still erases them) and concretely typing
`self.configuration` across 29 call sites risks latent mismatches. The `conf`
getter gets the full win without it. Skip Layer 1 unless a separate need for a
typed `self.configuration` arises.

## Generalizing to displays (the real target)

Internet accounts proved the pattern. To apply it to displays:
1. Tighten each display factory's `configSchema` param from
   `AnyConfigurationSchemaType` to the concrete schema model type (the schema's
   `XConfigModel` alias) — required, else `Instance<typeof configSchema>` is
   `AnyConfigurationModel` and reads stay `any`.
2. Add the `conf` getter and route `getConf(self, 'x')` / `readConfObject` reads
   through `readConfObject(self.conf, 'x')`.
3. Drop redundant scalar getter annotations; keep `as TheUnion` for stringEnum
   slots. Displays that read their slots via `getConfWithOverride` are a separate
   path (see `key_pattern_getconfwithoverride_typing`) — the `conf` getter
   complements, doesn't replace, that.
