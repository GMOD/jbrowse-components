---
id: scoreaxiswidget
title: ScoreAxisWidget
description: "Drawer widget editing one display's value scale, its encoding.y."
sidebar_label: Widget -> ScoreAxisWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/ScoreAxisWidget/stateModel.ts).

Drawer widget editing one display's value scale, its `encoding.y`. The display is
a safe reference, so hiding its track or closing its view empties it rather
than leaving the widget writing to a dead node.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>string</code> · default <code>createElementId()</code> | The identifier references to this node resolve through. A snapshot that leaves it out gets a generated one. |
| <span id="property-type">**type**</span><br><code>"ScoreAxisWidget"</code> | Always `"ScoreAxisWidget"`, the name a snapshot selects this model by. |
| <span id="property-display">**display**</span><br><code>DisplayModel &#124; undefined</code> |  |
| <span id="property-label">**label**</span><br><code>string</code> · default <code>'Y axis'</code> | The name of the menu row that opened the widget, "Y axis" or "Coverage axis"; the heading shows the same name. |
