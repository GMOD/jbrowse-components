---
id: scoreaxiswidget
title: ScoreAxisWidget
sidebar_label: Widget -> ScoreAxisWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/ScoreAxisWidget/stateModel.ts).

Drawer widget editing one display's value scale, `scales.y`. The display is
a safe reference, so hiding its track or closing its view empties it rather
than leaving the widget writing to a dead node.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('ScoreAxisWidget')</code> |  |
| <span id="property-display">**display**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>display: types.safeReference( pluginManager.pluggableMstType('d…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>display: types.safeReference(&#10;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('display', 'stateModel'),&#10;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-label">**label**</span><br><code>label: types.optional(types.string, 'Y axis')</code> | The name of the menu row that opened it, "Y axis" or "Coverage axis", so the heading says the same. |
