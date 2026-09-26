---
id: syntenyfademixin
title: SyntenyFadeMixin
sidebar_label: Mixin -> SyntenyFadeMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyFadeMixin.ts).

The two fades a view drawing synteny ribbons offers, whatever the colour
mode: an alignment by its sequence identity, and a sub-pixel alignment by
its on-screen width, so a dense whole-genome picture keeps its density
instead of saturating. The linear synteny view and the circular view both
compose it; a view supplies `autoFadeWidthPx`.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-opacitybyidentity">**opacityByIdentity**</span><br><code>opacityByIdentity: types.stripDefault(types.boolean, false)</code> | Fade alignment blocks by per-feature identity (lower identity = more transparent), whatever the color mode. |
| <span id="property-fadethinalignmentsmode">**fadeThinAlignmentsMode**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>fadeThinAlignmentsMode: types.stripDefault( types.enumeration('…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>fadeThinAlignmentsMode: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.enumeration('FadeThinMode', ['auto', 'on', 'off']),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'auto',&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Fade a sub-pixel-thin ribbon's opacity by its on-screen width, so an unfiltered whole-genome view doesn't read as a full-opacity hairball. 'auto' fades once a display is dominated by sub-pixel ribbons and leaves a sparse comparison at full alpha; 'on'/'off' pin it. Resolved view-wide by `fadeThinAlignments`. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-fadethinlatch">**fadeThinLatch**</span><br><code>fadeThinLatch: false</code> | Whether the 'auto' thin-fade is latched on (see `fadeThinAlignments`). |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-autofadewidthpx">**autoFadeWidthPx**</span><br><code>number</code> | Overridable hook: the width 'auto' compares against its thresholds, the narrowest capped mean block width of any display with enough blocks to judge, or `Infinity` with none. |
| <span id="getter-fadethinalignments">**fadeThinAlignments**</span><br><code>boolean</code> | The resolved fade-thin flag every display renders by. 'auto' fades once any loaded display is dominated by sub-pixel ribbons, latched with a deadband (`fadesThinAt`, ADR-083) so a view near the threshold does not flip while panning. View-wide, so every display fades together. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setopacitybyidentity">**setOpacityByIdentity**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setfadethinalignmentsmode">**setFadeThinAlignmentsMode**</span><br><code>(arg: FadeThinMode) =&gt; void</code> |  |
| <span id="action-setfadethinlatch">**setFadeThinLatch**</span><br><code>(arg: boolean) =&gt; void</code> | Move the latched 'auto' thin-fade decision — `installAutoFadeLatch` is the only caller. |
