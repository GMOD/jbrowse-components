---
name: a-featurefield-expression-is-checked-where-it-is-written
description: Nothing compiles a featureField's `jexl:` expression at load, in `jbrowse validate`, in the JSON schema or in the editor, so a typo shows only when a worker reader compiles it. A syntax-only compile in the snapshot preprocessor would name the slot, but it cannot see a plugin-registered function and the readers already throw once compiled. Parked on 2026-10-07 by the grammar audit's review; waits on a user asking for it.
---

# A featureField expression is checked where it is written

A `featureField` slot takes a field name, a dotted path or a `jexl:` expression
(`website/docs/config_guides/slot_types.md`). Its MST type is a plain string,
the JSON schema's `FeatureField` is a bare string, `jbrowse validate` runs the
schema and nothing more over one, and the config editor is a text box. A
misspelt expression loads, and the display's worker finds it.

What the worker does with one, as of 2026-10-07: a `facet`, a `rows.field`, a
`clusterField`, a quantitative `y` and a mark channel reject the fetch, and the
track shows the syntax error; a feature label draws no label
(`plugins/canvas/src/RenderFeatureDataRPC/labelUtils.ts`); the multi-way `text`
logs and falls back to the name (`geneTextOf` in
`plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/model.ts`).

## What a fix would be

A compile of every featureField value in `preProcessSnapshotWith`
(`packages/core/src/configuration/snapshotPreprocess.ts`), which already
refuses a callback in a slot that takes none, so load, `setSlot`, the editor
and the validator would each name the slot.

## Why it waits

- `jexl.compile` checks syntax only. A function a plugin registers is known to
  the live `pluginManager.jexl` and fails at evaluation, so the CLI, which
  loads no plugins, could vouch for the syntax and nothing else.
- It is a second place that knows jexl, run on every `create`.
- The loud readers already put the error on the track. The two quiet ones are
  a label, where no text is the mildest failure a display has, and the
  multi-way `text`, a main-thread getter with no fetch to reject.
