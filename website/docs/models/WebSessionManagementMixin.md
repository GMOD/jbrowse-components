---
id: websessionmanagementmixin
title: WebSessionManagementMixin
sidebar_label: Mixin -> WebSessionManagementMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/WebSessionManagement.ts).

Saved-session-database actions (favorites, recent sessions, activate/delete)
delegating to the root's AbstractWebSessionDbRootModel. Composed only by the
full-app jbrowse-web session; react-app omits it (its root has no session
database).

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-savedsessionmetadata">**savedSessionMetadata**</span><br><code>SessionMetadata[] &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-deletesavedsession">**deleteSavedSession**</span><br><code>(id: string) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-deletesavedsessions">**deleteSavedSessions**</span><br><code>(ids: string[]) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-setsavedsessionfavorite">**setSavedSessionFavorite**</span><br><code>(id: string, favorite: boolean) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-renamesavedsession">**renameSavedSession**</span><br><code>(id: string, name: string) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-activatesession">**activateSession**</span><br><code>(id: string) =&gt; Promise&lt;void&gt;</code> |  |
