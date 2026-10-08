---
id: configurationeditorwidget
title: ConfigurationEditorWidget
description: "Widget for editing a config model's slots in a form: holds the target configuration and debounce-saves edits back to the session."
sidebar_label: Widget -> ConfigurationEditorWidget
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `config` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/ConfigurationEditorWidget/model.ts).

Widget for editing a config model's slots in a form: holds the target
configuration and debounce-saves edits back to the session.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('ConfigurationEditorWidget')</code> |  |
| <span id="property-trackid">**trackId**</span><br><code>trackId: types.maybe(types.string)</code> | the track whose working copy this edits, re-resolved on every read so an undo that replaces the copy moves the editor with it |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-inlinetarget">**inlineTarget**</span><br><code>AnyConfigurationModel &#124; undefined</code> |  |
| <span id="volatile-expandeddisplayid">**expandedDisplayId**</span><br><code>string &#124; undefined</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-target">**target**</span><br><code>AnyConfigurationModel &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-settrackid">**setTrackId**</span><br><code>(trackId: string) =&gt; void</code> | edit the working copy of `trackId`, saving any edit still pending on the previous target first |
| <span id="action-settarget">**setTarget**</span><br><code>(newTarget: AnyConfigurationModel &#124; undefined) =&gt; void</code> | edit a config node directly, saving any edit still pending on the previous target first |
| <span id="action-setexpandeddisplayid">**setExpandedDisplayId**</span><br><code>(displayId: string &#124; undefined) =&gt; void</code> |  |
