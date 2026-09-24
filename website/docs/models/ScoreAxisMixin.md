---
id: scoreaxismixin
title: ScoreAxisMixin
sidebar_label: Mixin -> ScoreAxisMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/ScoreAxisMixin.ts).

Not a cross-cutting mixin any more: ScoreScaleMixin is its one
composer, and a display takes the axis by taking that. The two stay apart
because the halves answer different questions — this one derives, the other
says where the answer is written.

The axis contract apart from where it is written down. `scaleType`,
`manualMinScore` and `manualMaxScore` are declared here with neutral answers
and a composing display overrides them, so the bounds, the "is anything
pinned" question, the ticks and the cross-hatches derive the same way
wherever the declaration lives. ScoreScaleMixin is the one composer
in the tree, backing them with the `scales.y` object every quantitative
display declares; the split stays because the derived half is what a display
writing its scale down somewhere else would answer.

The setters are not here. A display cannot set what it has not said where to
put, so `setScaleType`/`setMinScore`/`setMaxScore` belong to whichever
composer owns the declaration — one owner, whichever it is.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-scaletype">**scaleType**</span><br><code>string</code> | Overridable: where this display's scale type is written down. |
| <span id="getter-manualminscore">**manualMinScore**</span><br><code>number &#124; undefined</code> | Overridable: the lower bound the config really pins, `undefined` where nothing does. |
| <span id="getter-manualmaxscore">**manualMaxScore**</span><br><code>number &#124; undefined</code> | Overridable: the upper bound the config really pins. |
| <span id="getter-defaultscoredomain">**defaultScoreDomain**</span><br><code>[number &#124; undefined, number &#124; undefined]</code> | Overridable hook: what each end of the domain falls back to where the config leaves its bound unset. `[undefined, undefined]` — the default — means autoscale both ends, which is right for a track whose scores have no absolute meaning (a bigwig's units are its own).<br><br>A display whose scores are bounded *by construction* overrides it, so the axis stops being a function of what happens to be on screen: GC content is a fraction, so 0 and 1 are its real limits and mean the same thing at every locus. Autoscaled, the same GC value drew at different heights depending on where the user had panned, and the track could not be read across loci.<br><br>A hook rather than a config default because the answer can depend on display state — GC's does, on `gcMode` — and rather than each display re-resolving the sentinels, which is the one thing that must not be duplicated: config bounds still win, precisely because they are checked before this is consulted. |
| <span id="getter-valuescales">**valueScales**</span><br><code>ValueScale[]</code> | Overridable hook (default none): the scales this display draws its y through. A display that answers it gets an axis per band of each, with its cross-hatches, placed by `DisplayChrome` and `renderDisplaySvg`, and the ticks derived below. |
| <span id="getter-autoscalegroup">**autoscaleGroup**</span><br><code>string &#124; undefined</code> | Overridable: the group this display's unpinned ends autoscale in, beside every display in its view naming the same one. |
| <span id="getter-autoscalerange">**autoscaleRange**</span><br><code>[number, number] &#124; undefined</code> | Overridable: what this display's own data spans, before any bound, nice-rounding or group widens it; what a group unions. |
| <span id="getter-autoscaleddomain">**autoscaledDomain**</span><br><code>[number, number] &#124; undefined</code> | The domain an autoscaled axis draws: `autoscaleRange`, widened to every range its `autoscaleGroup` holds, nice-rounded inside this display's own bounds. Each member unions the others' own ranges and never their domains, so a pinned end stays the display's that pinned it. `undefined` while this display has nothing of its own to scale. |
| <span id="getter-minscorebound">**minScoreBound**</span><br><code>number &#124; undefined</code> | Resolved lower bound; `undefined` means autoscale this end. |
| <span id="getter-maxscorebound">**maxScoreBound**</span><br><code>number &#124; undefined</code> | Resolved upper bound; `undefined` means autoscale this end. |
| <span id="getter-hasmanualscorebounds">**hasManualScoreBounds**</span><br><code>boolean</code> | Whether the user has pinned either end, which is a different question from whether either end resolved to a number: `defaultScoreDomain` fills the unset ends in, so a GC content track answers yes to the second with nothing configured. The score menu asks this one — it gates the "Clear manual min/max" row, and a Clear that writes the nothing already there is a row that does nothing and never goes away. |
| <span id="getter-axes">**axes**</span><br><code>YAxis[]</code> | The axes, one per declared scale whose domain resolved: where each tick lands in the band's own pixel space, through `computeYTicks` unless the scale brought its own ladder, and where each of the scale's `rules` inside the domain lands in that same box, through the scale type the renderer places its values by. |
