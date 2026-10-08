---
id: jbrowsereactapprootmodel
title: JBrowseReactAppRootModel
description: "note: many properties of the root model are available through the session, and we generally prefer using the session model (via e.g. getSession) over the root model (via e.g. getRoot) in plugin code"
sidebar_label: Root -> JBrowseReactAppRootModel
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. [View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/src/rootModel/rootModel.ts).

note: many properties of the root model are available through the session,
and we generally prefer using the session model (via e.g. getSession) over
the root model (via e.g. getRoot) in plugin code

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<span data-pagefind-ignore>From [BaseRootModel](../baserootmodel): <span id="property-jbrowse">[`jbrowse`](../baserootmodel#property-jbrowse)</span>, <span id="property-session">[`session`](../baserootmodel#property-session)</span>, <span id="property-sessionpath">[`sessionPath`](../baserootmodel#property-sessionpath)</span>, <span id="property-assemblymanager">[`assemblyManager`](../baserootmodel#property-assemblymanager)</span></span>

<span data-pagefind-ignore>From [InternetAccountsMixin](../internetaccountsmixin): <span id="property-internetaccounts">[`internetAccounts`](../internetaccountsmixin#property-internetaccounts)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-version">**version**</span><br><code>string</code> |  |
| <span id="volatile-pluginsupdated">**pluginsUpdated**</span><br><code>false</code> |  |
| <span id="volatile-pluginsupdatedcallback">**pluginsUpdatedCallback**</span><br><code>((args: PluginsUpdate) =&gt; void) &#124; undefined</code> | host hook for PluginsUpdated, set from createViewState's `onPluginsUpdated`. Undefined means the host didn't ask to handle it. |

<span data-pagefind-ignore>From [BaseRootModel](../baserootmodel): <span id="volatile-rpcmanager">[`rpcManager`](../baserootmodel#volatile-rpcmanager)</span>, <span id="volatile-adminmode">[`adminMode`](../baserootmodel#volatile-adminmode)</span>, <span id="volatile-error">[`error`](../baserootmodel#volatile-error)</span>, <span id="volatile-textsearchmanager">[`textSearchManager`](../baserootmodel#volatile-textsearchmanager)</span>, <span id="volatile-pluginmanager">[`pluginManager`](../baserootmodel#volatile-pluginmanager)</span></span>

<span data-pagefind-ignore>From [RootAppMenuMixin](../rootappmenumixin): <span id="volatile-mutablemenuactions">[`mutableMenuActions`](../rootappmenumixin#volatile-mutablemenuactions)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menus">**menus**</span><br><code>() =&gt; Menu[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setpluginsupdated">**setPluginsUpdated**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setpluginsupdatedcallback">**setPluginsUpdatedCallback**</span><br><code>(callback: (args: PluginsUpdate) =&gt; void) =&gt; void</code> |  |

<span data-pagefind-ignore>From [BaseRootModel](../baserootmodel): <span id="action-seterror">[`setError`](../baserootmodel#action-seterror)</span>, <span id="action-setsession">[`setSession`](../baserootmodel#action-setsession)</span>, <span id="action-setdefaultsession">[`setDefaultSession`](../baserootmodel#action-setdefaultsession)</span>, <span id="action-setsessionpath">[`setSessionPath`](../baserootmodel#action-setsessionpath)</span>, <span id="action-renamecurrentsession">[`renameCurrentSession`](../baserootmodel#action-renamecurrentsession)</span></span>

<span data-pagefind-ignore>From [InternetAccountsMixin](../internetaccountsmixin): <span id="action-initializeinternetaccount">[`initializeInternetAccount`](../internetaccountsmixin#action-initializeinternetaccount)</span>, <span id="action-createephemeralinternetaccount">[`createEphemeralInternetAccount`](../internetaccountsmixin#action-createephemeralinternetaccount)</span>, <span id="action-findappropriateinternetaccount">[`findAppropriateInternetAccount`](../internetaccountsmixin#action-findappropriateinternetaccount)</span></span>

<span data-pagefind-ignore>From [RootAppMenuMixin](../rootappmenumixin): <span id="action-appendmenu">[`appendMenu`](../rootappmenumixin#action-appendmenu)</span>, <span id="action-insertmenu">[`insertMenu`](../rootappmenumixin#action-insertmenu)</span>, <span id="action-appendtomenu">[`appendToMenu`](../rootappmenumixin#action-appendtomenu)</span>, <span id="action-insertinmenu">[`insertInMenu`](../rootappmenumixin#action-insertinmenu)</span>, <span id="action-appendtosubmenu">[`appendToSubMenu`](../rootappmenumixin#action-appendtosubmenu)</span>, <span id="action-insertinsubmenu">[`insertInSubMenu`](../rootappmenumixin#action-insertinsubmenu)</span></span>
