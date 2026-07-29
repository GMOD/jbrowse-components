---
id: internetaccountsmixin
title: InternetAccountsMixin
sidebar_label: Mixin -> InternetAccountsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/InternetAccounts.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-internetaccounts">**internetAccounts**</span><br><details><summary><code>internetAccounts: types.array( pluginManager.pluggableMstType('…</code></summary><pre><code>internetAccounts: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('internet account', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-initializeinternetaccount">**initializeInternetAccount**</span><br><details><summary><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStat…</code></summary><pre><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, initialSnapshot?: any) =&gt; any</code></pre></details> |  |
| <span id="action-createephemeralinternetaccount">**createEphemeralInternetAccount**</span><br><details><summary><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unk…</code></summary><pre><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unknown&gt;, url: string) =&gt; any</code></pre></details> |  |
| <span id="action-findappropriateinternetaccount">**findAppropriateInternetAccount**</span><br><code>(location: UriLocation) =&gt; any</code> |  |
