---
status: Accepted
summary: "The feature display's `labels.name` and `labels.description` are `featureField` slots: a plain string names the field a label line reads (`gene_name`), as it does on the multi-way display's `text` and a mark's `encoding.text`, where it was a constant and a field needed `jexl:get(feature,…)`. The worker reads both through `fieldReader`, built once per render; an empty value still switches a line off, and the two defaults stay the visible jexl expressions, which a `featureField` may now default to. The object keeps its name: renaming `labels.name` to `text` needed a new word for the description, which a session spec would otherwise write to the track's own `description`, a second meaning for `showLabels`' `name`, and a permanent second spelling for the hosted configs that write `labels`"
---

# ADR-220: A feature label names a field, and stays `labels`

## Status

Accepted (2026-10-07). Settles the canvas `labels.name` → `text` rename of the
2026-10-07 grammar audit, which Colin approved and a review then priced; he
chose this form. Extends
[ADR-155](adr-155-a-slot-takes-a-callback-only-where-it-declares-one.md).

## Context

The feature label was spelt three ways: the feature display's
`labels: { name, description }`, two callback strings whose plain value was a
constant; the multi-way display's `text`; and a mark's `encoding.text`, both
`featureField` slots whose plain value names a field. Labelling genes by
`gene_name`, the commonest label setting, took
`"jexl:get(feature,'gene_name')"` on one display and `"gene_name"` on the
other two. The audit proposed `text` and a description slot of its own. A
review of that plan found four costs:

- A display slot named `description` is unreachable from a session spec's
  track entry or a share link, since `applyConfSettings` writes a key the
  track declares to the track, and the track declares `description`.
- `''` is how the worker's label config switches a line off, which the
  variant lane relies on, where the multi-way `text` reads `''` as its
  name-else-ID default.
- `showLabels` names the two lines `name` and `description`, so
  `showLabels: "name"` would govern a slot called `text`.
- jb2hubs writes display-level `labels.name` into hosted configs that older
  releases read, so `labels` would stay a second spelling for good.

## Decision

- **`labels.name` and `labels.description` are `featureField`.** A plain
  string is a field, a dotted path or a `jexl:` expression, read by
  `fieldReader`. The object, its two member names and `showLabels`' words
  stay.
- **The defaults stay the jexl expressions** (`name` else `id`; `note` else
  `description` else `function`), so the editor and the config docs show what
  runs, and **an empty value draws no line**, as before.
- **A `featureField` may default to a `jexl:` expression**, the value it
  already takes. `ConfigSlot` refused one with the callback slots' message,
  which told the author to declare the `contextVariable` a `featureField`
  refuses.
- **The worker builds the two readers once per config object**
  (`labelUtils.ts`), which is once per render: the layout pass and the collect
  pass both read labels off the one config. An expression that does not
  compile, or throws on a feature, draws no label.

## Consequences

- `"labels": { "name": "gene_name" }` labels by that field. Every config
  writing a `jexl:` label loads and draws as before.
- A plain non-empty label string, which labelled every feature with the same
  text, reads as a field name. No in-tree config, doc or figure spec wrote
  one.
- A label field needs no jexl instance, so a subfeature's label follows the
  slot in the layout tests that pass none.
- `mouseover` stays a callback string, the one text slot on the display whose
  plain value is a constant, since a fixed tooltip is a real setting.

## Rejected alternatives

- **Renaming to `text` with a second slot**, for the four costs above.
- **Defaulting both to `''` and reading the name and description in code**, as
  the multi-way `text` does. It saves two jexl evaluations per feature on the
  default path and gives `''` two meanings on one object.
- **Threading the readers through `LayoutArgs` and `RenderContext`.** The
  config object already reaches every call site in both passes.
- **Lifting a v4 constant label to a `jexl:` string.** A lift for a setting
  that drew one text on every feature.
