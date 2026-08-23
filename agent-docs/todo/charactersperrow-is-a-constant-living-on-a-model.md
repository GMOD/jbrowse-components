---
name: charactersperrow-is-a-constant-living-on-a-model
description: decide setting vs const; a setter with no UI is the worst option
metadata:
  area: feature details
  category: ready
---

# charactersPerRow is a constant living on a model

`SequenceFeatureDetailsF` declares `charactersPerRow: 100` as a `#volatile`
alongside four settings that each have an action and a localStorage round-trip.
This one has neither a setter nor any writer in the tree, so it is a constant
that pays the cost of looking like a setting: every reader goes through the
model, and the doc tables list it next to preferences a user can actually
change.

Two ways out, and they are not equivalent. Giving it an action and a localStorage
key makes it the "wider rows" setting the panel visibly lacks — the row width is
the one thing a user reading a long CDS wants to change, and the settings dialog
it would join already exists. Exporting it as a const from `consts.ts` instead is
the honest description of what it is today, and drops a member from a documented
model, so it wants `pnpm gendocs` and a check of
[reference/PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md) — a
removal on a model surface is the direction that fails quietly.

Do not do both halfway. A setter with no UI is the worst of the three.
