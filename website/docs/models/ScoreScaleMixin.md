---
id: scorescalemixin
title: ScoreScaleMixin
sidebar_label: Mixin -> ScoreScaleMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/ScoreScaleMixin.ts).

#crossCuttingMixin Score axis, written in the config slots. `scoreAxisConfigSchemaFields`. Brings `ScoreAxisMixin` plus `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `manual*` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume

The score axis of a display whose axis IS `minScore`, `maxScore` and
`scaleType`: wiggle, the multi-wiggle, Manhattan and the alignments coverage
band. It backs ScoreAxisMixin's three overridable members off those
slots and adds the setters that write them, so composing this is how a
display satisfies ScoreScaleModel in `scoreMenuItems.ts` — the
interface the shared Score menu, the autoscale/scale submenus and
`SetMinMaxDialog` consume. A display that writes its scale down somewhere
else composes `ScoreAxisMixin` and answers the three itself, which is what
the mark display does with `scales.y`.

Deliberately just the axis. Colors, `resolution`, cross-hatches and the
autoscale *computation* stay in `WiggleScoreConfigMixin` / `WiggleCommonMixin`
— the alignments coverage band shares this axis but none of the rest.

`minScore`/`maxScore` are the **raw** slot values with their
`Number.MIN_VALUE`/`Number.MAX_VALUE` "unset" sentinels intact, and nothing
outside this file should want them: `manualMinScore`/`manualMaxScore` are the
same values with the sentinel resolved to `undefined`, and the dialog
round-trips them and the menu captions itself with them;
`minScoreBound`/`maxScoreBound` are the resolved bounds, where `undefined`
means "autoscale this end". Every consumer that computes a domain reads the
`*Bound` pair.

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-scaletype">**scaleType**</span><br><code>string</code> |  | ScoreScaleMixin |
| <span id="getter-autoscaletype">**autoscaleType**</span><br><code>string</code> |  | ScoreScaleMixin |
| <span id="getter-numstddev">**numStdDev**</span><br><code>number</code> |  | ScoreScaleMixin |
| <span id="getter-minscore">**minScore**</span><br><code>number</code> | Raw slot value, sentinel intact — see the class comment. | ScoreScaleMixin |
| <span id="getter-maxscore">**maxScore**</span><br><code>number</code> | Raw slot value, sentinel intact — see the class comment. | ScoreScaleMixin |
| <span id="getter-manualminscore">**manualMinScore**</span><br><code>number &#124; undefined</code> | The lower bound the config really sets, `undefined` at the sentinel. | ScoreScaleMixin |
| <span id="getter-manualmaxscore">**manualMaxScore**</span><br><code>number &#124; undefined</code> | The upper bound the config really sets, `undefined` at the sentinel. | ScoreScaleMixin |
| <span id="getter-defaultscoredomain">**defaultScoreDomain**</span><br><code>[number &#124; undefined, number &#124; undefined]</code> | <span data-pagefind-ignore>Overridable hook: what each end of the domain falls back to where the config leaves its bound unset. `[undefined, undefined]` — the default — means autoscale both ends, which is right for a track whose scores have no absolute meaning (a bigwig's units are its own).<br><br>A display whose scores are bounded *by construction* overrides it, so the axis stops being a function of what happens to be on screen: GC content is a fraction, so 0 and 1 are its real limits and mean the same thing at every locus. Autoscaled, the same GC value drew at different heights depending on where the user had panned, and the track could not be read across loci.<br><br>A hook rather than a config default because the answer can depend on display state — GC's does, on `gcMode` — and rather than each display re-resolving the sentinels, which is the one thing that must not be duplicated: config bounds still win, precisely because they are checked before this is consulted.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-defaultscoredomain) |
| <span id="getter-valuescales">**valueScales**</span><br><code>ValueScale[]</code> | <span data-pagefind-ignore>Overridable hook (default none): the scales this display draws its y through. A display that answers it gets an axis per band of each, with its cross-hatches, placed by `DisplayChrome` and `renderDisplaySvg`, and the ticks derived below.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-valuescales) |
| <span id="getter-minscorebound">**minScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved lower bound; `undefined` means autoscale this end.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-minscorebound) |
| <span id="getter-maxscorebound">**maxScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved upper bound; `undefined` means autoscale this end.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-maxscorebound) |
| <span id="getter-hasmanualscorebounds">**hasManualScoreBounds**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the user has pinned either end, which is a different question from whether either end resolved to a number: `defaultScoreDomain` fills the unset ends in, so a GC content track answers yes to the second with nothing configured. The score menu asks this one — it gates the "Clear manual min/max" row, and a Clear that writes the nothing already there is a row that does nothing and never goes away.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-hasmanualscorebounds) |
| <span id="getter-axes">**axes**</span><br><code>YAxis[]</code> | <span data-pagefind-ignore>The axes, one per declared scale whose domain resolved: where each tick lands in the band's own pixel space, through `computeYTicks` unless the scale brought its own ladder.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-axes) |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setscaletype">**setScaleType**</span><br><code>(scaleType: string) =&gt; void</code> |  |
| <span id="action-setautoscale">**setAutoscale**</span><br><code>(val?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setminscore">**setMinScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setmaxscore">**setMaxScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
