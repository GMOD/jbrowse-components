# Plan: typed config reads — next steps

Status: **in progress.** The reader-typing change landed (commit `224dd07bcb`).
A pilot then established that the highest-value lever is **adapters**, not
displays, and added a generic `BaseAdapter<CONF>` so `this.getConf(...)` types
off the concrete schema (opt-in per subclass; full back-compat). The entire
`bed` plugin is the first rollout. Background analysis lives in
`agent-docs/CONFIG_SLOT_COLLAPSE_PLAN.md` → "Typed reads + AnyConfigurationModel".

## Pilot results (empirical, supersedes the display-first assumption below)

- **Display state models barely benefit.** Wiggle (and the override-driven
  displays generally) read their own slots via `getConfWithOverride<T>` — an
  explicit-generic reader that *bypasses* the typed `getConf`/`readConfObject`
  path entirely. Their direct `getConf` reads mostly hit `name` / `adapter` /
  frozen slots → `any`. Typing the factory's `configSchema` param is safe
  (tsgo-clean, no circular-import issue) but surfaces **zero** typed reads, so
  it's pure churn. Reverted.
- **Adapters are the dense direct-read population.** `BaseAdapter.getConf`
  returned `any` only because `config: AnyConfigurationModel`. SPARQLAdapter
  already typed its config param (`Instance<typeof schema>`) and got typed reads
  — but it was 1 of ~155 sites.

## The adapter lever (landed in this branch's working tree)

`BaseAdapter<CONF extends AnyConfigurationModel = AnyConfigurationModel>` and
`BaseFeatureDataAdapter<CONF>` are now generic; `getConf` is typed via the same
`ConfigurationSlotName`/`ConfigurationSlotValue` machinery as `readConfObject`.
The **default** type param is `AnyConfigurationModel`, so all ~40 existing
adapters compile unchanged (`any` reads preserved). Each `configSchema.ts`
exports a named `Instance` alias next to its schema (follow-on A, now adopted):

```ts
// configSchema.ts
const XAdapter = ConfigurationSchema('XAdapter', { ... })
export type XAdapterConfig = Instance<typeof XAdapter>
export default XAdapter
```

```ts
// XAdapter.ts — opt in
import type { XAdapterConfig } from './configSchema.ts'

export default class XAdapter extends BaseFeatureDataAdapter<XAdapterConfig> { ... }
// now: this.getConf('scoreColumn') : string
//      this.getConf('colRef')      : number
//      this.getConf('notASlot')    // compile error, lists valid slots
```

Non-scalar slots (`fileLocation`, `stringArray`, frozen) still read `any` by
design, so casts/annotations on those (`as FileLocation`,
`columnNames: string[]`) stay. Only redundant **scalar** annotations come off.

First rollout: the whole `bed` plugin (7 adapters) is opted in; redundant
`: string`/`: number`/`: boolean` annotations on scalar reads removed. tsgo
clean, all 74 bed tests pass, no latent bugs surfaced (annotations already
matched slot types). `ConfigurationSchemaForModel`/`ConfigurationSlotName`/
`ConfigurationSlotValue` are now re-exported from `core/configuration`.

Remaining opt-in targets (opportunistic, per the no-big-bang guardrail below):
~27 other `BaseFeatureDataAdapter` subclasses, 9 direct `BaseAdapter`
subclasses, plus text-search / sequence / refname-alias adapters.

## What already landed

`readConfObject`/`getConf` now infer a slot's value type from its `defaultValue`
(scalars typed precisely; arrays/maps/sub-schemas/`frozen` → `any`). Slot **names**
were already validated; now the **return** is typed too — but **only when the
config's schema is statically known**. The schema is known when the value is an
`Instance<concreteSchema>`; it is erased to `any` when the value is typed
`AnyConfigurationModel`.

So the typed reads are live, but ~1883 usage sites type their config as
`AnyConfigurationModel` and therefore still read `any`. The migration below flips
those to concrete schema types to collect the win.

## The core mechanism (verified)

A usage "declares the config it expects" via the **schema type**, not a
structural/instance shape (config instances are schema-erased — they carry no
typed slot properties, so a duck shape like `{ color: string }` is NOT assignable
from a config instance; direct `conf.color` is not the path).

```ts
import type { Instance } from '@jbrowse/mobx-state-tree'
import type wiggleConfigSchema from '../LinearWiggleDisplay/configSchema.ts'

type WiggleConfig = Instance<typeof wiggleConfigSchema>

function drawWiggle(conf: WiggleConfig) {
  const r = readConfObject(conf, 'defaultRendering') // : string (typed)
  readConfObject(conf, 'notASlot')                   // compile error
}
```

Verified against the real `LinearWiggleDisplay` schema (shared field objects +
`baseConfiguration` preserve the typing). The opaque path stays `any`:

```ts
function drawOpaque(conf: AnyConfigurationModel) {
  readConfObject(conf, 'color') // : any — no schema to type against
}
```

## Rollout sequence (adapters)

Per-adapter conversion is the unit of work. Each is local and zero-runtime-risk:
add the `Instance` alias to `configSchema.ts`, point the class at it via the
generic param, drop any now-redundant **scalar** annotations, run
`npx tsgo --noEmit` + `pnpm test <plugin dir>`. A read whose old `any` result was
used at the wrong type becomes a compile error — that's a genuine bug find, not
churn. Convert opportunistically (no big-bang); the ordering below is by
read-density / bug-finding potential, not a mandate to do all at once.

- **Done:** `bed` plugin (7 adapters).
- **Done:** `comparative-adapters` — `BlastTabularAdapter` (dropped `as string`
  on `columns`), `PairwiseIndexedPAFAdapter` (dropped `as number` on
  `coarseBpPerPxThreshold`), `MCScanAnchorsAdapter`, `MCScanSimpleAnchorsAdapter`
  (convention + `as string[]` on `assemblyNames` stays — stringArray → `any`).
  **Deferred:** `PAFAdapter`/`ChainAdapter`/`DeltaAdapter`/`MashMapAdapter` —
  these only read `fileLocation` slots (all `any`) so there are no scalar casts
  to drop; the inheritance chain (subclasses override `setupPre` and read
  different slot names from the parent) makes concrete typing non-trivial.
- **Done:** `alignments` — `CramAdapter` (`fetchSizeLimit` now typed `number`).
  **Deferred:** `BamAdapter`/`HtsgetBamAdapter` — `HtsgetBamAdapter` extends
  `BamAdapter` and reads `htsgetBase`/`htsgetTrackId` (slots not in
  `BamAdapterConfig`); concrete-typing `BamAdapter` breaks the subclass.
  Resolution options: make `BamAdapter` generic
  (`class BamAdapter<CONF extends AnyConfigurationModel = BamAdapterConfig>`)
  — parent body loses self-typed `getConf` returns; OR separate the adapters
  and add explicit `readConfObject(this.config as unknown as HtsgetBamAdapterConfig, ...)`
  in HtsgetBamAdapter.
- **Done:** `config plugin` — `RefNameAliasAdapter` (`refNameColumn` number,
  `refNameColumnHeaderName` string), `NcbiSequenceReportAliasAdapter`
  (`useNameOverride` boolean).
- **Done:** `sequence` — `SequenceSearchAdapter` (dropped 4 scalar casts:
  `search`, `searchForward`, `searchReverse`, `caseInsensitive`).
- **Done:** `gtf` — `GtfTabixAdapter` (dropped `as string` on `aggregateField`),
  `GtfAdapter` (same).
- **Done:** `wiggle` — `BigWigAdapter` (`source` string, `resolutionMultiplier`
  number now typed).
- **Done:** `gff3` — `Gff3TabixAdapter` (convention; `dontRedispatch`
  stringArray cast stays).
- **Done:** `variants` — `VcfTabixAdapter`, `VcfAdapter` (convention;
  fileLocation/frozen stays `any`).
- **Done:** `alignments` — `BamAdapter` (`fetchSizeLimit` typed number).
  `HtsgetBamAdapter` extends `BamAdapter`; typed via
  `readConfObject(this.config as unknown as HtsgetBamAdapterConfig, ...)` since
  its slots are not in BamAdapterConfig.
- **Done:** `BaseSequenceAdapter<CONF>` — generic param threaded (mirrors
  `BaseFeatureDataAdapter<CONF>`). `TwoBitAdapter` and `UnindexedFastaAdapter`
  opted in (`rewriteRefNames` string now typed in Unindexed). `IndexedFastaAdapter`
  kept non-generic because `BgzipFastaAdapter extends IndexedFastaAdapter` and
  reads `gziLocation` (not in `IndexedFastaAdapterConfig`) — same subclass
  conflict as BamAdapter/HtsgetBamAdapter. Config type alias exported for both.
- **Done:** `gccontent` — `GCContentAdapter` (`windowSize`/`windowDelta` number,
  `gcMode` `'content'|'skew'` now typed). Factory-pattern schema uses
  `Instance<ReturnType<typeof GCContentAdapterF>>`.

- **Done:** `maf` — `MafTabixAdapter` (`refAssemblyName` now typed `string`).
  The `getSamplesFromConfig(key => this.getConf(key))` blocker was removed by
  refactoring `getSamplesFromConfig(nhLocation, samplesConfig)` to take the two
  resolved values directly (typed `FileLocation` + `SampleConfig`, dropping two
  internal casts) instead of a dynamic-string getter; call sites pass
  `this.getConf('nhLocation')`/`this.getConf('samples')` (literal slot names,
  constraint-safe). `BigMafAdapter`/`BgzipTaffyAdapter` left untyped on purpose
  — both have **zero scalar slots** (only frozen/fileLocation), so opting the
  class in is pure churn; their call sites use the new signature regardless.

**Remaining (low priority / blockers noted):**
- `PAFAdapter`/`ChainAdapter`/`DeltaAdapter`/`MashMapAdapter` — inheritance
  chain, zero scalar casts to drop in any of them. Deferred.
- `NCListAdapter`/`HicAdapter`/`Gff3Adapter`/`SplitVcfTabixAdapter`/`MultiWiggleAdapter`/`SPARQLAdapter` — fileLocation/frozen/stringArray only, or already typed via constructor-param pattern (SPARQL). Deferred until touched for other reasons.
- `IndexedFastaAdapter` / `BgzipFastaAdapter` — same subclass conflict as
  BamAdapter/HtsgetBamAdapter; `IndexedFastaAdapterConfig` alias exported but
  class kept non-generic.

Base classes done: `BaseSequenceAdapter<CONF>` threaded. Remaining interfaces
(`BaseRefNameAliasAdapter`, `BaseTextSearchAdapter`, `RegionsAdapter`) need no
threading — they are interfaces, not classes.

## Displays — separate, lower-priority track

The reader typing is live for `getConf`/`readConfObject`, but display state
models read their own slots through `getConfWithOverride<T>` (explicit generic,
bypasses the typed reader). To make displays benefit, `getConfWithOverride`
would need to infer `T` from the schema — but it lives on the shared
`ConfigOverrideMixin` where `self.configuration` is `AnyConfigurationModel`
(erased), so it can't without making the mixin generic over the display's
schema. Deferred; the win there is small (most display reads are
`name`/`adapter`/frozen → `any` anyway). Free functions / renderers that take a
typed config param and read scalar slots are the exception worth converting.

Guardrail: where a usage genuinely handles *arbitrary* configs (generic editor,
hydration, copy-config, `getConfigOverrides`, wrapper adapters forwarding a
subadapter config), `AnyConfigurationModel` is correct — keep it.

## Caveats to respect during migration

- **jexl is unaffected.** The typed return is the slot's declared (default) type;
  `readConfObject` still evaluates `jexl:` strings at runtime and the callback is
  declared to return that same type. No read-site change needed.
- **Non-scalar slots stay `any`** by design (arrays/maps/sub-schemas/`frozen`).
  Don't try to force-type them — the `defaultValue` of an unannotated
  `stringArray` infers `never[]`, and object reads return a snapshot. If a usage
  wants a typed array/object read, annotate at the call site as today.
- **Don't loosen `AnyConfigurationModel`.** It's the load-bearing branded MST type
  for schema-agnostic code. The ~90 `as AnyConfigurationModel` casts are mostly
  legitimate `any → typed` annotations that this migration doesn't touch.

## Follow-on A — `XConfig` alias convention (ADOPTED)

Each `configSchema.ts` exports `export type XConfig = Instance<typeof schema>`
next to its `ConfigurationSchema(...)` and consumers import that instead of
re-deriving `Instance<typeof schema>`. Mechanical, improves readability, no
behavior change. Adopted in the `bed` plugin rollout; apply to each schema as
its adapter opts in.

## Optional follow-on B — structural duck type (probably skip)

A truly structural `ConfigWith<{ color: string }>` is expressible via an optional
phantom brand (`AnyConfigurationModel & { readonly __slots?: SLOTS }`, so any
config is assignable) plus reader machinery that types off `__slots`. It lets a
generic util say "any config with a color slot" without importing a schema. Cost:
it duplicates slot types at each usage and adds a second typing path to the
reader. Referencing the concrete schema is cleaner for almost all cases, so this
is a fallback only for genuinely schema-generic utilities — likely skip.

## Not in scope here

The larger "toward native MST" direction (deleting the config layer, reading via
`node.x`) is analyzed in `CONFIG_SLOT_COLLAPSE_PLAN.md` and recommended **against**
as a project — the slot collapse already captured the perf, and native `node.x`
on a value union is fragile (any slot can be a jexl callback). This plan is the
pragmatic alternative: keep the reader, just make it typed and let usages opt in.
