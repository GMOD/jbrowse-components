---
id: desktopsessiontrackmenumixin
title: DesktopSessionTrackMenuMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/TrackMenu.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DesktopSessionTrackMenuMixin.md)

## Docs

### DesktopSessionTrackMenuMixin - Methods

#### method: getTrackActions

raw track actions (Settings, Copy, Delete, Index) without submenu wrapper

```js
// type signature
getTrackActions: (trackConfig: BaseTrackConfig) => MenuItem[]
```

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```js
// type signature
getTrackListMenuItems: (trackConfig: BaseTrackConfig) => MenuItem[]
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: (trackConfig: BaseTrackConfig, extraTrackActions?: MenuItem[]) => MenuItem[]
```
