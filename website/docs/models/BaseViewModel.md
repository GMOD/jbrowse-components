---
id: baseviewmodel
title: BaseViewModel
sidebar_label: View -> BaseViewModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseViewModel.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | displayName is displayed in the header of the view, or assembly names being used if none is specified |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> | collapse the view to its header bar, keeping it in the session rather than closing it |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-width">**width**</span><br><code>width: 800</code> |  |
| <span id="volatile-bodymounted">**bodyMounted**</span><br><code>bodyMounted: true</code> | Whether the container has this view's body in the DOM.<br><br>`ViewContainer` mounts a view's body only while an IntersectionObserver says it is on screen, to hold the app under the WebGL2 context ceiling (`reference/GPU_CONTEXT_BUDGET.md`). A view below the fold therefore has no canvas, so nothing ever calls `markCanvasDrawn` and the pre-first-paint term of `displayPhase` pins every display in it at `loading` with nothing left to resolve it — which parks `[data-app-phase="ready"]` for the whole app on a view the user cannot see.<br><br>Defaults true so the containers that always mount a body — embedded views, workspace panels, and any test rendering a display directly — are unaffected and need not set it.<br><br>The raw flag, written by this view's own container. A display asks `effectiveBodyMounted` instead, because a nested view has no container of its own. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-effectivebodymounted">**effectiveBodyMounted**</span><br><code>boolean</code> | Whether this view's body is in the DOM, counting the views it is nested inside — which is the question a display's phase actually asks.<br><br>`bodyMounted` alone answers it only for a view a container renders directly. A view nested in another view (a synteny row, a breakpoint panel) has no container writing its flag, so it reads `true` forever while its whole subtree is out of the DOM, and every display in it waits for a first paint that nothing will make — the hang this flag exists to prevent, one level down.<br><br>An ancestor that does not carry the flag at all leaves the answer alone rather than excusing the paint: only an explicit `false` unmounts, so a duck-typed stand-in that forgot it keeps waiting, which is the failure that shows up as a slow test rather than as a picture of an empty view. |

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
| <span id="action-setbodymounted">**setBodyMounted**</span><br><code>(flag: boolean) =&gt; void</code> | See `bodyMounted`. Written by the view's container, which is the only thing that knows whether it rendered the body. |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  |
