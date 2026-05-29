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

## Docs

extends [BaseWebSession](../basewebsession)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseWebSession](../basewebsession)

**Properties:** sessionPlugins

**Volatiles:** sessionThemeName, pendingFileHandleIds

**Getters:** tracks, root, assemblies, connections, assemblyNames, version,
shareURL, textSearchManager, assemblyManager, savedSessionMetadata, history

**Methods:** renderProps, getTrackActions, getTrackListMenuItems,
getTrackActionMenuItems, menus

**Actions:** addAssemblyConf, addSessionPlugin, removeSessionPlugin,
deleteSavedSession, setSavedSessionFavorite, renameCurrentSession,
activateSession, setDefaultSession, setSession, editTrackConfiguration
