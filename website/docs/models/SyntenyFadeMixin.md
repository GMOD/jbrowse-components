---
id: syntenyfademixin
title: SyntenyFadeMixin
description: "The fade a view drawing synteny ribbons offers whatever the color mode: a sub-pixel alignment by its on-screen width, so a dense whole-genome picture keeps its density instead of saturating."
sidebar_label: Mixin -> SyntenyFadeMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/SyntenyFadeMixin.ts).

The fade a view drawing synteny ribbons offers whatever the color mode: a
sub-pixel alignment by its on-screen width, so a dense whole-genome picture
keeps its density instead of saturating. A fade by the data is the
`opacity` object's (`SyntenyColorsMixin`). The linear synteny view and the
circular view both compose it; a view supplies `autoFadeWidthPx`.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-render">**render**</span><br><code>render: types.stripDefault(syntenyRenderConfigSchema, {})</code> | How the ribbons rasterize, a [](/docs/config/syntenyrender) object: `antialias` fades a sub-pixel ribbon by its on-screen width, so an unfiltered whole-genome view doesn't read as a full-opacity hairball. Unset, it fades once sub-pixel ribbons dominate a display and leaves a sparse comparison at full alpha; `true` and `false` fix it. Resolved view-wide by `fadeThinAlignments`. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-fadethinlatch">**fadeThinLatch**</span><br><code>boolean</code> | Whether the 'auto' thin-fade is latched on (see `fadeThinAlignments`). |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-autofadewidthpx">**autoFadeWidthPx**</span><br><code>number</code> | Overridable hook: the width 'auto' compares against its thresholds, the narrowest capped mean block width of any display with enough blocks to judge, or `Infinity` with none. |
| <span id="getter-antialias">**antialias**</span><br><code>boolean &#124; undefined</code> | `render.antialias`, undefined while it follows the data. |
| <span id="getter-fadethinalignments">**fadeThinAlignments**</span><br><code>boolean</code> | The resolved fade-thin flag every display renders by. 'auto' fades once sub-pixel ribbons dominate any loaded display, latched with a deadband (`fadesThinAt`, ADR-083) so a view near the threshold does not flip while panning. View-wide, so every display fades together. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setantialias">**setAntialias**</span><br><code>(antialias: boolean &#124; undefined) =&gt; void</code> |  |
| <span id="action-setfadethinlatch">**setFadeThinLatch**</span><br><code>(arg: boolean) =&gt; void</code> | Move the latched 'auto' thin-fade decision — `installAutoFadeLatch` is the only caller. |
