---
id: pointerhovermixin
title: PointerHoverMixin
description: "A hover derived from the pointer. The hit type, as the type parameter."
sidebar_label: Mixin -> PointerHoverMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/PointerHoverMixin.ts).

A hover derived from the pointer. The hit type, as the type parameter. Brings the `pointer` volatile, `setPointer` for the chrome's `onPointerPosition`, the `hoverHitAt` hook a display overrides, and the `hoveredFeature` getter `BaseDisplay` declares as a hook

The derived counterpart of `StoredHoverMixin`: the display stores the
pointer's position, and the hover is `hoverHitAt` at that position. A pan, a
zoom, a scroll or a fetch landing under a stationary cursor re-resolves the
hit, so no reaction clears it on the viewport's axes and
`clearHoveredFeature` stays `BaseDisplay`'s no-op. The chrome drops the
pointer, reporting `undefined` when it leaves, a banner replaces the
container, or a context menu opens or closes.

`sameHit` names the fields that make two hits one hover: a hit test hands
back a fresh object per call, and without it every pointer move would
invalidate the highlight and every other reader of `hoveredFeature`.

Compose it after `BaseDisplay` so the typed getter wins, and override
`hoverHitAt` in the display's own views.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-pointer">**pointer**</span><br><code>PointerPx &#124; undefined</code> | where the pointer is over the display, or undefined while it is not |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-hoveredfeature">**hoveredFeature**</span><br><code>T &#124; undefined</code> | what is under the pointer, re-resolved whenever the content under it moves |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-hoverhitat">**hoverHitAt**</span><br><code>(_x: number, _y: number) =&gt; T &#124; undefined</code> | Overridable hook (default nothing): what hovering at this container-px point names. A display that answers no hover while its data reloads says so here. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setpointer">**setPointer**</span><br><code>(state?: PointerPx &#124; undefined) =&gt; void</code> | the chrome's `onPointerPosition` |
