---
id: lodtierinfomixin
title: LodTierInfoMixin
sidebar_label: Mixin -> LodTierInfoMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/LodTierInfoMixin.ts).

What the tiered adapter said about its file, held by every display that
resolves a level-of-detail tier (LinearSyntenyDisplay, DotplotDisplay,
LGVSyntenyDisplay) and read by their `lodTier` getters through
`resolveLodTier`. Filled by `installLodTierInfoFetch`; undefined until it
lands, which the resolver treats as "trust the config slot".

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-lodtierinfo">**lodTierInfo**</span><br><code>lodTierInfo: undefined as LodTierInfo &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setlodtierinfo">**setLodTierInfo**</span><br><code>(info: LodTierInfo &#124; undefined) =&gt; void</code> |  |
