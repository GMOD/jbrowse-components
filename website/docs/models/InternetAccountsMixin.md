---
id: internetaccountsmixin
title: InternetAccountsMixin
sidebar_label: Mixin -> InternetAccountsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/InternetAccounts.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-internetaccounts">**internetAccounts**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>internetAccounts: types.array( pluginManager.pluggableMstType('…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>internetAccounts: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('internet account', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-initializeinternetaccount">**initializeInternetAccount**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStat…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, initialSnapshot?: object) =&gt; any</code></pre></dialog></span> |  |
| <span id="action-createephemeralinternetaccount">**createEphemeralInternetAccount**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unk…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unknown&gt;, url: string) =&gt; any</code></pre></dialog></span> |  |
| <span id="action-findappropriateinternetaccount">**findAppropriateInternetAccount**</span><br><code>(location: UriLocation) =&gt; any</code> |  |
