---
name: a-featurefield-expression-is-checked-where-it-is-written
description: The feature display names a plot's bad `jexl:` expression in its notices (`plotJexlProblems`), but other displays, `jbrowse validate` and the config editor do not, so there a typo surfaces only when a worker compiles it. Waits on a user asking.
---

# A featureField expression is checked where it is written

A `featureField` slot takes a field name, a dotted path or a `jexl:` expression
(`website/docs/config_guides/slot_types.md`). Its MST type is a plain string,
the JSON schema's `FeatureField` is a bare string, `jbrowse validate` runs the
schema and nothing more over one, and the config editor is a text box.

One family already checks them where they are written.
`packages/core/src/util/jexlDiagnostics.ts`'s `jexlProblems` reports a syntax
error or a function the live `pluginManager.jexl` does not register, and the
feature display's `configProblemsOf` runs it over every expression in its plot
(`plotJexlProblems` in `plugins/features/src/LinearBasicDisplay/plotProblems.ts`:
channels, facet, transform steps, labels, filter), so its notices and Edit plot
name the setting. `JexlFilterDialog` checks a filter as it is typed.

Elsewhere a misspelt expression loads, and the display's worker finds it: a
`rows.field`, a `clusterField`, a quantitative `y` or a mark channel rejects
the fetch and the track shows the syntax error; the multi-way `text` logs and
falls back to the name (`geneTextOf` in
`plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/model.ts`).

## What a fix would be

Lift the plot walk into `BaseDisplayModel.configProblemsOf`, so every display's
notices name a bad expression the way the feature display's do, and have
`jbrowse validate` run `jexlProblems` against a bare jexl.

## Why it waits

- The CLI loads no plugins, so it could vouch for the syntax and nothing else:
  a function a plugin registers would read as unregistered.
- The loud readers already put the error on the track. The quiet one is the
  multi-way `text`, a main-thread getter with no fetch to reject.
