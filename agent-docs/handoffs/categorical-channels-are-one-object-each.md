---
name: categorical-channels-are-one-object-each
description: Decided 2026-09-18 and not yet built — a display's facet and categorical colour become one config object each (`facet: "HP" | { field, domain }`, `color: "red" | "jexl:…" | { field, domain, palette }`), replacing the flat `facetField`/`facetDomain`/`colorField`/`colorDomain`/`colorPalette` slots on the feature, mark and multi-sample variant displays, with alignments' `groupBy` and the GWAS, multiway and synteny colour slots following. Read before touching any of those slots, and before arguing for flat again.
---

# Categorical channels are one object each

**Decided 2026-09-18, not built.** Two Fable reviews ran the same day: the
first kept the slots flat, and the second, told that breaking changes are free
and that effort does not choose the design, reversed it. Colin took the second.
The categorical machinery this spelling sits on is on branch
`worktree-categorical-one-rule` (`categoricalField`, the domain that only
orders, the display-level facet of
[ADR-130](../architecture-decision-records/adr-130-a-facet-is-the-displays-and-splits-before-each-layers-steps.md)).
Delete this file once the conversion lands and an ADR records the spelling.

## The end state

```json
{ "type": "LinearBasicDisplay", "facet": "strand", "color": "goldenrod" }
```

```json
{
  "type": "LinearBasicDisplay",
  "facet": { "field": "gene_biotype", "domain": ["protein_coding", "lncRNA"] },
  "color": { "field": "gene_biotype", "palette": ["#1f77b4", "#ff7f0e"] }
}
```

```json
{
  "type": "LinearMarkDisplay",
  "transform": [
    { "type": "formula", "expr": "jexl:getTag(feature,'HP')", "as": "HP" }
  ],
  "facet": { "field": "HP", "domain": ["2", "1"] },
  "marks": [
    {
      "shape": "span",
      "transform": [{ "type": "stack" }],
      "encoding": { "row": "row", "color": { "field": "HP" } }
    }
  ]
}
```

```json
{
  "type": "LinearMultiSampleVariantDisplay",
  "facet": "population",
  "rowColor": "population"
}
```

The rules:

- **A string is the channel's one-value form.** For a channel that has a
  constant (`color`), the string is the constant: a CSS colour or a `jexl:`
  callback. For a channel that is only ever a field (`facet`, `rowColor`),
  the string is the field. `{ "value": … }` exists only as what a colour string
  lifts into, and no example shows it.
- **An object replaces the channel; `null` clears it.** There is no merge. A
  writer that changes only the order (the Sections menu) already knows the
  field and writes the whole object back.
- **A `domain` or `palette` with no `field` is refused** when the snapshot is
  read, so a stale domain cannot be stored.
- **The keys keep their names.** `color` stays `color`, so a config writing
  `"color": "red"` needs no change.

## Why nested, stated for the API

These are reasons about what a user writes, reads, validates and gets back.
None of them is about how the code happens to be organised.

1. **A domain means nothing without its field.** As one object they cannot
   drift apart. As flat slots they already do: `setFacet` has to write two
   slots in step, choosing a solid colour has to clear three others, and
   `colorField` carries a precedence sentence ("it wins over `color` while
   set"). All of that exists only because one declaration is stored as two to
   four keys.
2. **The product already speaks nested everywhere but the config file.** The
   mark display's channels are objects (`encoding.color`, `encoding.y`). Edit
   as JSON shows `{ facet: { field, domain }, color: { field, domain,
   palette } }`, the worker request is `facet: { field }`, the runtime object
   every channel reads is `categoricalField(field, { domain, palette })`, and
   the agent's `jb.help` describes the nested spec. Flat config makes a user
   learn one shape in the dialog and write another in the file.
3. **The validator can check inside the object.** A nested sub-schema's JSON
   schema is `anyOf [string, object]` with `additionalProperties: false`, so
   `jbrowse validate` catches a misspelt `field` key with a suggestion and reports a wrong
   type at `facet.field`. Under flat, it tells a user who pasted the dialog's
   spelling that the dialog is wrong.
4. **Edit as JSON stops being a translation layer.** It becomes an editor over
   the display's real settings, and `applyChannelSpec`, `facetOf`, `colorOf`
   and most of `channelSpec.ts`'s hand-written checks are deleted. What stays
   is the jexl syntax check, which has no other home.

## The case for flat, and why each point fails

- **"`color` cannot be a colour and a sub-schema at once."** It can.
  `MarkColor` (`plugins/marks/src/LinearMarkDisplay/configSchema.ts`) already
  holds `"red"`, `"jexl:…"` and `{ field, scale, domain, palette }` in one key
  through `preProcessSnapshot: liftValue`. No rename is needed; jbrowse-img's
  `canvasColor` (`products/jbrowse-img/src/applyTrackOpts.ts`) changes one
  line.
- **"`applyDisplaySettings` only writes top-level slots."** True today. A
  nested key throws in `setSlot` and lands in `failed`. The fix is one branch
  to `setSubschema`, and `setSubschema` runs the sub-schema's preprocessor, so
  `"strand"` expands there too. That was checked on 2026-09-18 with a
  throwaway test: `setSubschema('color', 'green')` gives `value: 'green'`, and
  `{ field }` resets the unnamed slots to their defaults. So this is code to
  add, not a property of the API.
- **"The mark display already exposes flat getters."** ADR-130's own commit
  added them, so the argument is circular.
- **"`jbrowse validate` reports a pasted `facet: {…}`."** It does, and that
  is an argument against flat: the product flags its own dialog's spelling as
  an error.
- **"Edit as JSON already bridges it in 25 lines."** The bridge is the cost,
  not a reason to keep it.
- **"About half a day, and no new capability."** Effort, which does not
  choose the design here. Typing and read speed were already settled against
  flat: `ConfigurationSlotPath` types nested paths (bb88dc2334, +0.64%
  instantiations), and the worker reads a plain snapshot.

## Build order

1. **Feature, mark and variant displays, one landing** (about 40 files):
   - Replace `facetConfigSchemaFields` with a shared `facet` sub-schema in
     display-kit, with `liftField` for the shorthand and the field-required
     check.
   - Replace the canvas `colorField`/`colorDomain`/`colorPalette` slots with a
     `color` sub-schema. Its `value` slot is `maybeColor`, so an unset colour
     still lets a BED `itemRgb` paint.
   - Move the canvas and mark models, `derivedColorKey`, `facet.ts`, the menus
     and dialogs, and the `rpcProps` keys onto the two objects.
   - Variants: `facet` replaces `facetField`/`facetDomain`, and `rowColor`
     replaces `colorBy`. It is not called `color`, because the cells there are
     coloured by genotype and `color` would read as the cells' colour.
   - `applyDisplaySettings` gets a sub-schema branch, `null` clears, and
     `jb.describeSlots` lists sub-schemas; today it filters to
     `isSlotDefinitionEntry`, so an agent never sees `facet`. `jb.help` tells
     an agent to group and colour through `applyChannelSpec`, which goes; the
     sentence names `applyDisplaySettings({ facet, color })` instead, inside
     the 2048-character cap, and `docsRoster.test.ts` follows.
   - Edit as JSON parses its text and hands it to `applyDisplaySettings`.
   - Update `config_marks.json`, `website/scripts/specs/marks.ts`, the guides
     and tutorials that name `facetField`/`colorField`, and the variants'
     portable keys for a display-type switch. Then run `pnpm autogen`; the
     `ConfigSlotDefaults` snapshot moves on CI.
2. **Alignments `groupBy` becomes `facet`**: a real sub-schema that keeps
   `type`, because a dimension is not a field. `"strand"` lifts to
   `{ type: "strand" }`. Today the slot is `frozen`, so the validator checks
   nothing inside it.
3. **GWAS, multiway and synteny colour slots** collapse the same way:
   `color: css | { field, domain, palette } | { scale: "ld" }` for GWAS, and
   `ribbonColor` for multiway, with the display's own `scale` vocabulary as
   `MarkColor` has.

With each landing, delete the flat-justification paragraph in
`agent-docs/reference/GRAMMAR_OF_GRAPHICS.md` §"The facet stage" rather than
rewriting it, and write an ADR that supersedes ADR-130's "two flat slots"
sentence.

## What does not change

- **The bare row-order `domain`** on the tree-sidebar, multi-row and multiway
  displays stays as it is. It orders rows no field produces, so a one-key
  object would be nesting for its own sake.
- **The mark display's `encoding.*` channels**, which were already the target
  shape.
- **The facet's level and semantics** (ADR-130): it is display-level, it
  splits before each mark's steps, and its domain only orders.
- **Alignments' `colorBy`**, which selects a colouring scheme, most of them not
  a field through a scale. It is not part of this plan.
