---
id: storedhovermixin
title: StoredHoverMixin
sidebar_label: Mixin -> StoredHoverMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/StoredHoverMixin.ts).

#crossCuttingMixin A stored hover. The hit type, as the type parameter. Brings the `hoveredFeature` getter `BaseDisplay` declares as a hook, `setHoveredFeature`, and the `clearHoveredFeature` the foundations' viewport-change reaction calls

For a display whose hover is a hit it stores from the pointer handler rather
than one it derives from an id index: the volatile, the getter that fills
`BaseDisplay`'s `hoveredFeature` hook (declared there as a computed, so a
volatile cannot take the name directly), the setter, and the clear. Compose
it after `BaseDisplay` so the typed getter wins.

`sameHit` is the identity a display's pointer handler resolves fresh on every
move: a display whose hit is a new object per frame names the fields that
make two of them one hover, so a mouse moving inside one block writes
nothing and invalidates no observer.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-storedhoveredfeature">**storedHoveredFeature**</span><br><code>storedHoveredFeature: undefined as T &#124; undefined</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-hoveredfeature">**hoveredFeature**</span><br><code>T &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-sethoveredfeature">**setHoveredFeature**</span><br><code>(hit?: T &#124; undefined) =&gt; void</code> |  |
| <span id="action-clearhoveredfeature">**clearHoveredFeature**</span><br><code>() =&gt; void</code> |  |
