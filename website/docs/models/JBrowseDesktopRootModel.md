---
id: jbrowsedesktoprootmodel
title: JBrowseDesktopRootModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/rootModel/rootModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseDesktopRootModel.md)

## Docs

composed of

- [BaseRootModel](../baserootmodel)
- [InternetAccountsMixin](../internetaccountsmixin)
- [DesktopSessionManagementMixin](../desktopsessionmanagementmixin)
- [HistoryManagementMixin](../historymanagementmixin)
- [RootAppMenuMixin](../rootappmenumixin)

note: many properties of the root model are available through the session, and
we generally prefer using the session model (via e.g. getSession) over the root
model (via e.g. getRoot) in plugin code

### JBrowseDesktopRootModel - Properties

#### property: jobsManager

```js
// type signature
IOptionalIType<IModelType<{}, { running: boolean; statusMessage: string; progressPct: number; jobName: string; jobsQueue: IObservableArray<TextJobsEntry>; finishedJobs: IObservableArray<...>; } & { ...; } & { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
jobsManager: types.optional(JobsManager, {})
```

### JBrowseDesktopRootModel - Methods

#### method: menus

```js
// type signature
menus: () => Menu[]
```

### JBrowseDesktopRootModel - Actions

#### action: setOpenNewSessionCallback

```js
// type signature
setOpenNewSessionCallback: (cb: (arg: string) => Promise<void>) => void
```

#### action: setPluginsUpdated

```js
// type signature
setPluginsUpdated: () => Promise<void>
```
