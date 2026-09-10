---
status: Accepted
summary: "The manifest generator walks the live ConfigurationSchema objects and state models a second time into one draft 2020-12 JSON Schema, published at https://jbrowse.org/jb2/schema/v5/config.json and bundled in the CLI beside the manifest. Every registered type is a $defs entry dispatched on `type` by an if/then chain, so a plugin's type passes unchecked; a slot carries its description, default and enum members and admits jexl:; a frozen slot stays open with the reason in its description; an enum value a migration still rewrites is a deprecated branch. jbrowse validate runs ajv first (a 50 ms command became 430 ms; ajv is 2.8 MB on disk) and keeps the six cross-reference checks and six migration warnings a schema cannot express. Fourteen error checks left validateConfig.ts, and the schema found four things the manifest never saw"
---

# ADR-120: One JSON Schema for config.json and the session spec

## Status

Accepted (2026-09-10). Closes the parity item
[SESSION_SPEC_FORMAT.md](../reference/SESSION_SPEC_FORMAT.md)'s assessment put
last: Gosling and GenomeSpy publish a schema and this format did not.
[ADR-089](adr-089-a-track-type-is-a-spec-the-factory-composes-the-stack.md)
and [ADR-091](adr-091-a-displays-settings-are-a-declaration.md) declined a grammar; this
is the schema that the flat format-typed spec gets instead.

## Context

`configManifest.generated.ts` was a schema in everything but format: 181 KB of
generated TypeScript read out of the live `ConfigurationSchema` objects — slot
names, MST type names, shorthand keys, legacy keys, each display's state-model
properties — and `jbrowse validate` walked a config against it in 816 lines of
hand-written checks. A reader's editor could use none of it, and each check the
validator grew (a session display node's keys, a view's launch keys, a
`displayDefaults` key) was a second statement of a rule the schema objects
already held.

Two facts shaped the emitter. The manifest stores MST type names as strings
(`"(JexlString | number)"`), so a schema cannot be a transform of the manifest;
it is a second walk of the same objects, off the same plugin-manager boot. And
`getConfigurationSchemaMetadata` returns each schema's slot *definition* table
— `type`, `description`, `defaultValue`, the enumeration `model` — which is
what an editor's hover wants and what the manifest's `properties` walk threw
away.

## Decision

**One generator, four outputs.** `scripts/generateConfigManifest.ts` boots the
plugin manager once and emits the manifest, the skill's type index, and the
schema twice: `products/jbrowse-cli/src/commands/validate/configSchema.generated.ts`
for the CLI (a JSON template literal, so the file lints and V8 parses it as
data) and `website/static/schema/v5/config.json` for editors. `pnpm autogen
--check` fails when any of the four drifts; `schemaValidate.test.ts` proves
the two schema copies equal and the schema's `$defs` set equal to the
manifest's type set, key for key.

**The shape.** `scripts/configJsonSchema.ts` is the walk:

- Every registered type gets `$defs/<Name>Slots` (the slot table, open) and
  `$defs/<Name>` (closed: `type`, the identifier, `allOf: [<Name>Slots]`,
  `unevaluatedProperties: false`). The split is what lets a track's
  `displayDefaults` intersect its displays' tables and a session track entry
  intersect one display's slots and state without restating either.
- A group is a union dispatched by `if: {type: X} then: $ref X`, one arm per
  type. A `type` no arm names passes with its keys unchecked — a plugin
  registers types the schema never saw, and JBrowse is loud about a type
  nothing registers. The `type` property carries the known names as a
  completion hint (`anyOf: [{enum}, {type: string}]`) without rejecting others.
- A slot is `description`, `default`, and its value or `jexl:` — the seven
  common value forms as shared defs (`NumberOrJexl`, `FileLocationOrJexl`,
  ...), an enum inline. The 67 `frozen`/`maybeFrozen` slots stay open with
  "Any JSON value: the slot is `frozen`" appended to their description: twelve
  tracks' `metadata`, ten adapters' `densityAdapter`, the sub-adapter slots
  (`sequenceAdapter`, `summaryAdapter`, `annotationAdapter`, `ldAdapter`,
  `subadapters`, `adapters`, `bigWigs`), the alignments display's `colorBy`,
  `filterBy`, `groupBy` and `sortedBy`, the variant displays' `samples`,
  `rowGroups`, `sampleColorMap` and `scoreRules`, `legend`, `features`,
  `showOutline`, and the PanSN and location maps. Typed sub-schemas — a mark's
  `encoding`, `transform[]`, an adapter's `index` — come through as nested
  objects, deduplicated by content so twelve tracks share one `textSearching`.
- What a sub-schema's `preProcessSnapshot` lifts is probed, not listed: a bare
  string (`"y": "score"`) and a `uri` beside no `adapter` (`refNameAliases`),
  each admitted only when the probe comes back out of the lift. Adapter
  shorthands and legacy keys come off the manifest's own probes; a legacy key
  is a `deprecated` property. An enum *value* a migration rewrites
  (`showLabels: false`, `displayMode: "collapse"`) is probed the same way
  against `create()` and emitted as a deprecated `anyOf` branch.
- Session nodes: `$defs/<Display>Snapshot` and `$defs/<Track>Snapshot` from
  the state models, `$defs/<View>` from the view model plus its runtime launch
  keys (`tracks` typed as `$defs/<View>TrackEntry`, `views` as rows, `assembly`
  as a string or a list), `init` as the same key table marked deprecated, and
  `$defs/Session` from jbrowse-web's session model with `widgets` left open. A
  standalone view spec validates against `#/$defs/View`.

**The versioned URL.** `schema/v<major>/config.json`, the major read off
`products/jbrowse-web/package.json` at generation. Within a major the file
regenerates on every docs deploy; a slot that goes is gone from the schema the
next deploy, as it is from the app, and a legacy spelling a migration keeps is
a deprecated property rather than an absence. At a major bump the generator
writes the new segment and the old file stays committed as it last was —
`rclone sync` deletes what `dist/` does not carry, so keeping an old URL alive
means keeping its file in the tree. Every whole-config fence in the docs opens
with `"$schema"` at that URL, and `check-config-blocks.ts` fails one without.

**`jbrowse validate` runs the schema first.** ajv 8 (already in the lockfile
under `schema-utils` and `yaml-language-server`) compiles the schema at startup
— `validateSchema: false`, `code.optimize: 0`, and the shared slot defs cut
that from 630 ms to ~200 ms warm — and `schemaValidate.ts` turns each error
into the validator's own `Problem`: the path in the config's spelling, the
accepted keys with a did-you-mean read off the schema's `properties` and
`allOf` refs, and for a failed `anyOf` the errors of the branch the value was
written for (by `type`, by `locationType`, else by fewest errors), re-validated
alone through `ajv.getSchema` on the branch's pointer. `suggest.ts` is
unchanged and now fed entirely from the schema. `validateConfig.ts` keeps what
a schema cannot say: a duplicate `trackId`, an `assemblyNames` entry or a
view's `assembly` that no assembly defines, a `trackId` a view names that no
track defines, a loose track with no `assemblyNames` in a multi-assembly config,
no assemblies at all; and the warnings — an unregistered type, a legacy key, a
legacy value, a hand-written `sequenceAdapter`, a migrated display-instance
key, `init` nesting.

## Measurements

| | value |
| --- | ---: |
| schema, pretty / compact / gzip | 501 KB / 327 KB / 37 KB |
| `$defs` entries | 329 |
| shared slot defs referenced | 714 |
| manifest (`configManifest.generated.ts`) | 181 KB → 188 KB (legacy values, internet accounts) |
| ajv install (ajv + fast-uri + fast-deep-equal + json-schema-traverse + require-from-string) | 2.8 MB on disk, 661 KB of runtime JS |
| CLI `dist/` | 632 KB → 1.1 MB |
| `jbrowse validate test_data/volvox/config.json`, quiet machine | 50 ms → 430 ms |
| ajv compile, cold / warm | ~320 ms / ~200 ms |
| ajv standalone precompile (declined) | 4.1 MB of generated JS |
| `validateConfig.ts` | 816 → 536 lines; 14 error checks moved to the schema, 6 cross-reference checks and 6 warnings kept |
| `schemaValidate.ts` (ajv → Problem) | 378 lines |
| fixtures validated in the test | 37 `test_data/**/config.json`, 67 doc fences (every whole config, track and assembly in `website/docs` and `config_guides/`) |

## What the schema found that the manifest could not

- **`displayDefaults` routes a value to every display that declares the key,
  and two tutorial fences set `displayMode: "compact"` on a FeatureTrack**,
  whose arc display's `displayMode` is `arcs | semicircles`. `create()` throws
  on it in a dev build; a production build stores the value unchecked. The
  manifest checked key names only. The fences moved the setting onto an
  explicit `LinearBasicDisplay` entry; `collectDisplayOverrides` routing by
  slot acceptance rather than by name is the fix in core, not made here.
- **Seven fixtures carried session and view keys nothing declares** — a
  session's `margin` and `width`, a synteny view's dotplot-era `fontSize`,
  `tickSize` and `htextRotation`, an LGV's `bookmarkHighlightsVisible`, a
  breakpoint view's `headerHeight`, a dotplot sub-view's
  `interRegionPaddingWidth`. The old validator saw the view-level ones and
  nothing ran it over `test_data`; the session-level and sub-view ones it
  never checked.
- **`demos/ecoli_pangenome` and `test_data/dog10k` spell `showLabels` as
  `false` and `"off"`**, which the migration rewrites. They stay as they are:
  the schema admits the legacy branch and the CLI warns.
- **A circular view's `assembly` is a list** (ADR-116), which the first cut of
  the launch-key typing did not admit; the synteny_track guide's fence caught
  it.

## Consequences

- An editor pointed at the URL completes type names, slot names and enum
  members and shows each slot's description and default; a typo is underlined
  where `jbrowse validate` would have reported it. The ADR-117 rule that a
  `frozen` slot "drops out of the config docs and the JSON schema" is now
  literally true, and the list above is what a future ADR would type.
- `check-config-blocks.ts` validates a view-spec fence (one whose `type`
  names a view) against `$defs/View`; before, the shape test read it as a
  config and passed it with its `tracks` unexamined.
- Launch keys are typed by name (`assembly`, `loc`, `tracks`, `views`), not
  from the launcher's TypeScript interface, so an LGV's `assembly` admits a
  list the LGV would not take. Descriptions for launch keys are what
  `generateSpecKeyDocs.ts` renders into urlparams.md from source and the
  runtime registration does not carry; the schema has none for them.
- `validateSchema: false` in the CLI means the schema's own well-formedness is
  the test's job (`is a valid draft 2020-12 schema`), which also fails on any
  strict-mode complaint ajv would have logged.

## Rejected alternatives

- **A transform of the manifest into a schema.** The manifest holds MST type
  names as strings; `"(JexlString | (LocalPathLocation | UriLocation | ...))"`
  would have to be parsed back, and the descriptions and defaults are not in
  it at all.
- **`oneOf` over the types with a `type` const each.** ajv reports every
  branch's errors for a value that fails one, and a plugin's type fails all
  of them. The `if/then` chain reports one branch and passes an unknown type,
  which is the validator's existing rule; ajv's `discriminator` keyword would
  do the same and is not draft 2020-12.
- **`additionalProperties: false` with every slot restated per object.** The
  first cut, at 1.25 MB: a track's `displayDefaults` copied its displays'
  tables and a view's track entry copied twenty displays' slots and state.
  `allOf` over `<Name>Slots` with `unevaluatedProperties: false` is the same
  closed object at 500 KB.
- **ajv standalone code at generation time.** 4.1 MB of generated JS to save
  ~200 ms, and the union-branch re-validation needs a live instance.
- **`@cfworker/json-schema` or another small validator.** ajv is in the tree,
  and its `verbose` errors carry `parentSchema`, which is what the messages
  are built from.
- **Dropping the manifest.** `add-track` reads `displayDefaultsForTrackType`
  off it and the warnings need its legacy-key, legacy-value and alias tables,
  none of which a schema states. The drift test keeps the two equal.
