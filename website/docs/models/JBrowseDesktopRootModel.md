---
id: jbrowsedesktoprootmodel
title: JBrowseDesktopRootModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-desktop/src/rootModel/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/rootModel/index.ts)

composed of

- [BaseRootModel](../baserootmodel)
- [InternetAccountsMixin](../internetaccountsmixin)
- [DesktopMenusMixin](../desktopmenusmixin)
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
IOptionalIType<IModelType<{}, { running: boolean; statusMessage: string; progressPct: number; jobName: string; controller: AbortController; jobsQueue: IObservableArray<TextJobsEntry>; finishedJobs: IObservableArray<...>; } & { ...; } & { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
jobsManager: types.optional(JobsManager, {})
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
