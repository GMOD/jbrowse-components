---
id: jbrowsewebsessionmodel
title: JBrowseWebSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/sessionModel/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseWebSessionModel.md)

## Overview

The full-app web session: the shared web session plus the saved-session database
management surface (favorites, recent sessions, activate/delete).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [WebSessionManagementMixin](../websessionmanagementmixin)

**Getters:** savedSessionMetadata

**Actions:** deleteSavedSession, setSavedSessionFavorite, renameSavedSession,
activateSession
