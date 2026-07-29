---
id: baseviewmodel
title: BaseViewModel
sidebar_label: View -> BaseViewModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseViewModel.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-width">**width**</span><br><code>width: 800</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menuitems">**menuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> | width is an important attribute of the view model, when it becomes set, it often indicates when the app can start drawing to it. certain views like lgv are strict about this because if it tries to draw before it knows the width it should draw to, it may start fetching data for regions it doesn't need to<br><br>setWidth is updated by a ResizeObserver generally, the views often need to know how wide they are to properly draw genomic regions |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  |
