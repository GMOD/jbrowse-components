---
id: scorescalemixin
title: ScoreScaleMixin
sidebar_label: Mixin -> ScoreScaleMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/ScoreScaleMixin.ts).

#crossCuttingMixin Value scale, written in `scales.y`. `valueScaleSchema` / `scalesSchema`. Brings `ScoreAxisMixin` plus `scaleType` / `scaleTypeChoices` / `autoscaleType` / `numStdDev` / `numQuantile` / `symlogConstant` / `manual*` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume

The value scale of every quantitative display: wiggle, the multi-wiggle,
Manhattan, the alignments coverage band and the mark display each declare
`scales.y` through valueScaleSchema and compose this. It backs
ScoreAxisMixin's three overridable members off that object and adds
the setters that write it, so composing this is how a display satisfies
ScoreScaleModel in `scoreMenuItems.ts` — the interface the shared
Score menu, the scale and autoscale submenus and `SetMinMaxDialog` consume.

What a display's scale offers follows what it draws, so the members below
answer `undefined` where its factory call left them out: `autoscaleType` on
Manhattan, whose domain is plain min/max, and `symlogConstant` wherever
`symlog` is not among the scale types. `scaleTypeChoices` reads the declared
enum back, which is what the scale-type radio offers.

Deliberately just the scale. Colors, `resolution`, cross-hatches and the
autoscale *computation* stay in `WiggleScoreConfigMixin` / `WiggleCommonMixin`
— the alignments coverage band shares this scale but none of the rest.

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-scaletype">**scaleType**</span><br><code>string</code> |  | ScoreScaleMixin |
| <span id="getter-scaletypechoices">**scaleTypeChoices**</span><br><code>string[]</code> | The scale types this display's own enum admits, which is what the scale-type radio offers; a display with one draws no radio. | ScoreScaleMixin |
| <span id="getter-autoscaletype">**autoscaleType**</span><br><code>string &#124; undefined</code> | `undefined` on a display whose domain consults no autoscale mode. | ScoreScaleMixin |
| <span id="getter-numstddev">**numStdDev**</span><br><code>number</code> |  | ScoreScaleMixin |
| <span id="getter-numquantile">**numQuantile**</span><br><code>number</code> |  | ScoreScaleMixin |
| <span id="getter-symlogconstant">**symlogConstant**</span><br><code>number</code> | Raw slot; `0` means "derive from the domain". Resolve it with `resolveSymlogConstant` once the domain is known. | ScoreScaleMixin |
| <span id="getter-manualminscore">**manualMinScore**</span><br><code>number &#124; undefined</code> | The lower bound the config pins, `undefined` where it pins none. | ScoreScaleMixin |
| <span id="getter-manualmaxscore">**manualMaxScore**</span><br><code>number &#124; undefined</code> | The upper bound the config pins, `undefined` where it pins none. | ScoreScaleMixin |
| <span id="getter-scaletitle">**scaleTitle**</span><br><code>string &#124; undefined</code> | `scales.y.title` as written: `undefined` while unset, which leaves the caption to the display, and the empty string for an axis the author wants bare. Also `undefined` on a display whose scale declares no title. | ScoreScaleMixin |
| <span id="getter-scorerulesdeclared">**scoreRulesDeclared**</span><br><code>boolean</code> | Whether this display's scale declares `rules`, which is whether the score menu offers the reference lines. | ScoreScaleMixin |
| <span id="getter-scorerules">**scoreRules**</span><br><code>ValueScaleRule[]</code> | `scales.y.rules`, read off the live nodes: a snapshot strips a slot at its default, and a rule at 0 is one. Empty on a display whose scale declares no rules. | ScoreScaleMixin |
| <span id="getter-defaultscoredomain">**defaultScoreDomain**</span><br><code>[number &#124; undefined, number &#124; undefined]</code> | <span data-pagefind-ignore>Overridable hook: what each end of the domain falls back to where the config leaves its bound unset. `[undefined, undefined]` — the default — means autoscale both ends, which is right for a track whose scores have no absolute meaning (a bigwig's units are its own).<br><br>A display whose scores are bounded *by construction* overrides it, so the axis stops being a function of what happens to be on screen: GC content is a fraction, so 0 and 1 are its real limits and mean the same thing at every locus. Autoscaled, the same GC value drew at different heights depending on where the user had panned, and the track could not be read across loci.<br><br>A hook rather than a config default because the answer can depend on display state — GC's does, on `gcMode` — and rather than each display re-resolving the sentinels, which is the one thing that must not be duplicated: config bounds still win, precisely because they are checked before this is consulted.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-defaultscoredomain) |
| <span id="getter-valuescales">**valueScales**</span><br><code>ValueScale[]</code> | <span data-pagefind-ignore>Overridable hook (default none): the scales this display draws its y through. A display that answers it gets an axis per band of each, with its cross-hatches, placed by `DisplayChrome` and `renderDisplaySvg`, and the ticks derived below.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-valuescales) |
| <span id="getter-minscorebound">**minScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved lower bound; `undefined` means autoscale this end.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-minscorebound) |
| <span id="getter-maxscorebound">**maxScoreBound**</span><br><code>number &#124; undefined</code> | <span data-pagefind-ignore>Resolved upper bound; `undefined` means autoscale this end.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-maxscorebound) |
| <span id="getter-hasmanualscorebounds">**hasManualScoreBounds**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the user has pinned either end, which is a different question from whether either end resolved to a number: `defaultScoreDomain` fills the unset ends in, so a GC content track answers yes to the second with nothing configured. The score menu asks this one — it gates the "Clear manual min/max" row, and a Clear that writes the nothing already there is a row that does nothing and never goes away.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-hasmanualscorebounds) |
| <span id="getter-axes">**axes**</span><br><code>YAxis[]</code> | <span data-pagefind-ignore>The axes, one per declared scale whose domain resolved: where each tick lands in the band's own pixel space, through `computeYTicks` unless the scale brought its own ladder, and where each of the scale's `rules` inside the domain lands in that same box, through the scale type the renderer places its values by.</span> | [ScoreAxisMixin](../scoreaxismixin#getter-axes) |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setscaletype">**setScaleType**</span><br><code>(scaleType: string) =&gt; void</code> |  |
| <span id="action-setautoscale">**setAutoscale**</span><br><code>(val?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setminscore">**setMinScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setmaxscore">**setMaxScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setscorerules">**setScoreRules**</span><br><code>(rules: (number &#124; ValueScaleRule)[]) =&gt; void</code> | Replaces `scales.y.rules` whole, each entry in a form the config takes: a number, or `{ value, color, label }`. |
