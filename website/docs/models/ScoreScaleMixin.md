---
id: scorescalemixin
title: ScoreScaleMixin
sidebar_label: Mixin -> ScoreScaleMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/ScoreScaleMixin.ts).

#crossCuttingMixin Score axis. Nothing — the config slots. Brings `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `manual*` / `*Bound` / `hasManualScoreBounds` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume

The score axis every quantitative display shares: which scale, how to
autoscale it, and the manual min/max bounds. This is the runtime half of
ScoreScaleModel in `scoreMenuItems.ts` — that interface is what the
shared Score menu, the autoscale/scale submenus and `SetMinMaxDialog` consume,
and it was already the canonical contract while two displays hand-wrote
identical implementations of it (`WiggleScoreConfigMixin`, and the alignments
coverage band). Composing this is now how a display satisfies it, so a new
score display cannot satisfy it *partially*.

Deliberately just the axis. Colors, `resolution`, cross-hatches and the
autoscale *computation* stay in `WiggleScoreConfigMixin` / `WiggleCommonMixin`
— the alignments coverage band shares this axis but none of the rest.

`minScore`/`maxScore` are the **raw** slot values with their
`Number.MIN_VALUE`/`Number.MAX_VALUE` "unset" sentinels intact, and nothing
outside this file should want them: `manualMinScore`/`manualMaxScore` are the
same answer with the sentinel resolved to `undefined`, which is what the
dialog round-trips and what the menu captions itself with;
`minScoreBound`/`maxScoreBound` are the resolved bounds, where `undefined`
means "autoscale this end". Every consumer that computes a domain reads the
`*Bound` pair.

Whether a bound is *configured* is a third question, and `hasManualScoreBounds`
is the only getter that answers it — the resolved pair cannot, since
`defaultScoreDomain` is exactly the hook that turns an unset end into a number.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-scaletype">**scaleType**</span><br><code>string</code> |  |
| <span id="getter-autoscaletype">**autoscaleType**</span><br><code>string</code> |  |
| <span id="getter-numstddev">**numStdDev**</span><br><code>number</code> |  |
| <span id="getter-minscore">**minScore**</span><br><code>number</code> | Raw slot value, sentinel intact — see the class comment. |
| <span id="getter-maxscore">**maxScore**</span><br><code>number</code> | Raw slot value, sentinel intact — see the class comment. |
| <span id="getter-defaultscoredomain">**defaultScoreDomain**</span><br><code>[number &#124; undefined, number &#124; undefined]</code> | Overridable hook: what each end of the domain falls back to where the config leaves its bound unset. `[undefined, undefined]` — the default — means autoscale both ends, which is right for a track whose scores have no absolute meaning (a bigwig's units are its own).<br><br>A display whose scores are bounded *by construction* overrides it, so the axis stops being a function of what happens to be on screen: GC content is a fraction, so 0 and 1 are its real limits and mean the same thing at every locus. Autoscaled, the same GC value drew at different heights depending on where the user had panned, and the track could not be read across loci.<br><br>A hook rather than a config default because the answer can depend on display state — GC's does, on `gcMode` — and rather than each display re-resolving the sentinels below, which is the one thing that must not be duplicated: config bounds still win, precisely because they are checked before this is consulted. |
| <span id="getter-manualminscore">**manualMinScore**</span><br><code>number &#124; undefined</code> | The lower bound the config really sets, `undefined` at the sentinel. |
| <span id="getter-manualmaxscore">**manualMaxScore**</span><br><code>number &#124; undefined</code> | The upper bound the config really sets, `undefined` at the sentinel. |
| <span id="getter-minscorebound">**minScoreBound**</span><br><code>number &#124; undefined</code> | Resolved lower bound; `undefined` means autoscale this end. |
| <span id="getter-maxscorebound">**maxScoreBound**</span><br><code>number &#124; undefined</code> | Resolved upper bound; `undefined` means autoscale this end. |
| <span id="getter-hasmanualscorebounds">**hasManualScoreBounds**</span><br><code>boolean</code> | Whether the user has pinned either end, which is a different question from whether either end resolved to a number: `defaultScoreDomain` fills the sentinels in, so a GC content track answers yes to the second with nothing configured. The score menu asks this one — it gates the "Clear manual min/max" row, and a Clear that writes the sentinels already there is a row that does nothing and never goes away. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setscaletype">**setScaleType**</span><br><code>(scaleType: string) =&gt; void</code> |  |
| <span id="action-setautoscale">**setAutoscale**</span><br><code>(val?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setminscore">**setMinScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setmaxscore">**setMaxScore**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
