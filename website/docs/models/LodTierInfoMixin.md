---
id: lodtierinfomixin
title: LodTierInfoMixin
sidebar_label: Mixin -> LodTierInfoMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/LodTierInfoMixin.ts).

What the tiered adapter said about its file, held by every display that
resolves a level-of-detail tier (LinearSyntenyDisplay, DotplotDisplay,
LGVSyntenyDisplay, MultiWaySyntenyDisplay) and read by their `lodTier`
getters through `resolveLodTier`. Filled by `installLodTierInfoFetch`.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-adapterheaderread">**adapterHeaderRead**</span><br><code>adapterHeaderRead: undefined as AdapterRead&lt;unknown&gt; &#124; undefined</code> | The adapter's `CoreGetInfo` header, stamped with the adapter config it answers. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-adapterheader">**adapterHeader**</span><br><code>unknown</code> | The header of the adapter config the display holds, undefined until its read lands. |
| <span id="getter-lodtierinfo">**lodTierInfo**</span><br><code>LodTierInfo &#124; undefined</code> | The file's tiers, undefined until the header lands, which the resolver treats as "trust the config slot". |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setadapterheader">**setAdapterHeader**</span><br><code>(read: AdapterRead&lt;unknown&gt;) =&gt; void</code> |  |
