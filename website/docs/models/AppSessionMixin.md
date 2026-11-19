---
id: appsessionmixin
title: AppSessionMixin
description: "Session getters shared by the \"app\" products (desktop + web) that simply delegate to the root model — version, history, menus, assemblyManager — plus renameCurrentSession."
sidebar_label: Mixin -> AppSessionMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/AppSession/AppSessionMixin.ts).

Session getters shared by the "app" products (desktop + web) that simply
delegate to the root model — `version`, `history`, `menus`,
`assemblyManager` — plus `renameCurrentSession`. Centralized here so the
products compose one mixin instead of re-declaring (and diverging on) the
same root delegations. The root must satisfy AppSessionRoot.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-root">**root**</span><br><code>AppSessionRoot</code> |  |
| <span id="getter-version">**version**</span><br><code>string</code> |  |
| <span id="getter-gitcommit">**gitCommit**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-history">**history**</span><br><code>UndoHistory &#124; undefined</code> |  |
| <span id="getter-assemblymanager">**assemblyManager**</span><br><code><a href="../assemblymanager">AssemblyManager</a></code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menus">**menus**</span><br><code>() =&gt; Menu[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-renamecurrentsession">**renameCurrentSession**</span><br><code>(sessionName: string) =&gt; void</code> |  |
