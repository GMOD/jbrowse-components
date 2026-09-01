---
id: configurationeditorwidget
title: ConfigurationEditorWidget
sidebar_label: Widget -> ConfigurationEditorWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `config` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/ConfigurationEditorWidget/model.ts).

Widget for editing a config model's slots in a form: holds the target
configuration and debounce-saves edits back to the session.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('ConfigurationEditorWidget')</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-target">**target**</span><br><code>target: undefined as AnyConfigurationModel &#124; undefined</code> |  |
| <span id="volatile-expandeddisplayid">**expandedDisplayId**</span><br><code>expandedDisplayId: undefined as string &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-settarget">**setTarget**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(newTarget: (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;……</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(newTarget: (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-setexpandeddisplayid">**setExpandedDisplayId**</span><br><code>(displayId: string &#124; undefined) =&gt; void</code> |  |
