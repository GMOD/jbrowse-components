---
id: syntenyfiltermixin
title: SyntenyFilterMixin
description: "The filter every view drawing synteny tracks applies to the alignments: the linear synteny view's ribbons, the dotplot's segments and the circular view's ribbons."
sidebar_label: Mixin -> SyntenyFilterMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyFilterMixin.ts).

The `filter` every view drawing synteny tracks applies to the alignments:
the linear synteny view's ribbons, the dotplot's segments and the circular
view's ribbons.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-filter">**filter**</span><br><code>filter: types.stripDefault(fieldPredicateArray(), [])</code> | The alignments drawn, a list of [](/docs/config/fieldpredicate) entries an alignment must all pass. A field is any field `color` takes, or `length`, the alignment's bp on its own axis: `[{ field: 'length', gte: 10000 }]` clears a whole-genome hairball. A filter edit recolors and refetches nothing. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-predicates">**predicates**</span><br><code>FieldPredicate[]</code> | The `filter` list as the predicate compiler reads it. |
| <span id="getter-minlength">**minLength**</span><br><code>number</code> | The lower bound on `length`, 0 for none. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-lowerbound">**lowerBound**</span><br><code>(field: string) =&gt; number</code> | The lower bound the filter puts on `field`, 0 for none. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setfilter">**setFilter**</span><br><code>(predicates: FieldPredicate[]) =&gt; void</code> |  |
| <span id="action-setlowerbound">**setLowerBound**</span><br><code>(field: string, value: number) =&gt; void</code> | The slider on one field: `field` at least `value`, or no lower bound at 0. |
