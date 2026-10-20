---
id: facetwritesmixin
title: FacetWritesMixin
description: "The writes a display's facet object takes from a menu row, a dialog or a chip drag: the field the sections split by (facetByField) and their order (setFacetDomain)."
sidebar_label: Mixin -> FacetWritesMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/FacetWritesMixin.ts).

The writes a display's `facet` object takes from a menu row, a dialog or a chip drag: the field the sections split by (`facetByField`) and their order (`setFacetDomain`). Each rewrites the object as written, so what a pick leaves alone stays, and a pick of the field already grouping writes nothing. A display that resets its scroll when the sections change does it from `HiddenGroupsMixin`'s `dropGroupState`, which also runs for a facet an agent, a share link or "Edit plot" writes

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-writtenfacet">**writtenFacet**</span><br><code>WrittenFacet</code> | The `facet` object as written. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-facetbyfield">**facetByField**</span><br><code>(field: string) =&gt; void</code> | Split the sections by `field`, `''` for none, keeping the order and hidden sections while it is the field already grouping. |
| <span id="action-setfacetdomain">**setFacetDomain**</span><br><code>(domain: readonly string[]) =&gt; void</code> | The order the sections take, the ones it names first; `[]` sorts them all. |
