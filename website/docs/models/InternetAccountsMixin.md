---
id: internetaccountsmixin
title: InternetAccountsMixin
description: "Adds internet accounts to the root model, and finds the account that signs the request for a given file location."
sidebar_label: Mixin -> InternetAccountsMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/InternetAccounts.ts).

Adds internet accounts to the root model, and finds the account that signs
the request for a given file location.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-internetaccounts">**internetAccounts**</span><br><code><a href="../baseinternetaccountmodel">BaseInternetAccountModel</a>[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-initializeinternetaccount">**initializeInternetAccount**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(internetAccountConfig, …) =&gt; BaseInternetAccountModel &#124; …</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(internetAccountConfig: <a href="../../config/baseinternetaccount">BaseInternetAccountConfig</a>, initialSnapshot?: object) =&gt; <a href="../baseinternetaccountmodel">BaseInternetAccountModel</a> &#124; undefined</code></pre></dialog></span> |  |
| <span id="action-createephemeralinternetaccount">**createEphemeralInternetAccount**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(internetAccountId, …) =&gt; BaseInternetAccountModel</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unknown&gt;, url: string) =&gt; <a href="../baseinternetaccountmodel">BaseInternetAccountModel</a></code></pre></dialog></span> | An account for the whole origin `url` is on, which is what its `<TypeName>-<origin>` id names. Its one `domains` entry is the origin and a `/`, the URL-prefix spelling that matches only that scheme, host and port. |
| <span id="action-findappropriateinternetaccount">**findAppropriateInternetAccount**</span><br><code>(location: UriLocation) =&gt; <a href="../baseinternetaccountmodel">BaseInternetAccountModel</a> &#124; undefined</code> |  |
