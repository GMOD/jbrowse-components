---
name: typed-create-needs-the-shorthand-vocabulary
description: Typing `create()` off the schema definition, so a misspelled key in a config.json is a compile error, is one threaded type parameter and one visibility problem away — and the vocabulary it needs is already derived, in the generated config manifest, where the type level cannot see it.
---

# Typed `create()` needs the shorthand vocabulary

ADR-145 gave a config node's props real types, so `node.colorr` is a compile
error. The other direction — a misspelled key in the snapshot *going in* — is
still only checked by `ConfigurationSnapshot<SCHEMA>`, which an embedder has to
opt into. Making `create()` itself refuse an unknown key was measured and
rejected there. This is what re-opening it would cost, measured 2026-09-19.

## The measurement

Point `create`'s parameter at a mapped type over the schema's own definition
(keyed off the definition, **not** off `this` — through the schema type it
re-enters the interface it hangs on and costs 171 excessively-deep errors):

| | errors |
| --- | ---: |
| `tsc --build` | **1** |
| whole-project typecheck | **47** |

Down from the 115 ADR-145 recorded, because the 101 that were an
`explicitlyTyped` schema needing `type` went away when that became a type
parameter. **None of the 47 was a real typo** — the check works, and what it
refuses is keys that work.

## What the 47 are

| population | count | shape |
| --- | ---: | --- |
| a `shorthand` schema takes a bare string | 12 | `create('red')` on a colour or facet |
| a schema the fixture never declared `explicitlyTyped` on | 8 | `type` in the snapshot |
| a `preProcessSnapshot` migration's legacy keys | ~25 | `uri`, `renderer`, `color1`, `_comment`, `drivers`, `fieldName`, `textSearchAdapterId`, `showReferenceAlleles` |
| a test passing `null` or a widened record | 2 | |

The first two are mechanical: `shorthand` threads exactly as `explicitlyTyped`
did, and a fixture that means `explicitlyTyped` can say so.

## The third is the interesting one, and it is nearly solved already

57 schemas declare a `preProcessSnapshot`; 38 do it through a locally defined
`normalizeSnapshot`, and 36 of those are a thin call into one of two shared
expanders, `expandTabixShorthand` and `fillLocations`. So the vocabulary is not
57 bespoke lists — it is `uri`, `baseUri`, `csi`, `index` for the location
family, plus a short tail of per-schema renames.

**And it is already derived.** `scripts/generateConfigManifest.ts` executes each
`normalizeSnapshot` against probe snapshots, diffs what it derived, and records
the result as `shorthandKeys` — 59 schemas carry the field in
`products/jbrowse-cli/src/commands/validate/configManifest.generated.ts` and 43
of those list at least one key, and the CLI validator and the config docs
already read it. `expandTabixShorthand`'s
own doc comment says this is why it stayed a plain function rather than a schema
option.

So the gap is **visibility, not knowledge**: the truth lives in a generated
runtime artifact, and a type parameter cannot reach it. Two shapes worth
weighing before starting:

- **Declare and gate.** `shorthandKeys` becomes a schema option threaded as a
  type parameter, and `generateConfigManifest` — which already derives the
  truth by probing — fails when a declaration disagrees with it. Hand-written,
  but never silently wrong, which is how this repo settles the same tension
  elsewhere.
- **Emit a type.** The generator writes the keys as types beside the manifest.
  No hand-maintenance, but it has to attach to each schema's type parameter to
  be useful, and codegen into schema files is what ADR-052 refused for
  accessors.

Check what the probe actually attributes to one adapter before trusting a
derived key list per schema — the probing is global across adapters, so a key
one schema expands can show up against another.

## Why it is worth doing

A config.json is the one surface where a typo is silent and costly: MST drops
an undeclared key, `closed: true` covers only the schemas that set it, and
`ConfigurationSnapshot` fires only against an object literal an embedder chose
to annotate. `create()` is the funnel every config goes through.
