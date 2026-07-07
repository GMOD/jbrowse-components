---
id: basetrackmodel
title: BaseTrackModel
sidebar_label: Track -> BaseTrackModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/BaseTrackModel.ts).

## Overview

these MST models only exist for tracks that are _shown_. they should contain
only UI state for the track, and have a reference to a track configuration. note
that multiple displayed tracks could use the same configuration.

## Members

| Member                                                           | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                               | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [type](#property-type)                                           | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [configuration](#property-configuration)                         | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [minimized](#property-minimized)                                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [pinned](#property-pinned)                                       | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [displays](#property-displays)                                   | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [trackId](#getter-trackid)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [rpcSessionId](#getter-rpcsessionid)                             | Getters    | determines which webworker to send the track to, currently based on trackId                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [name](#getter-name)                                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [textSearchAdapter](#getter-textsearchadapter)                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [adapterConfig](#getter-adapterconfig)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [activeDisplay](#getter-activedisplay)                           | Getters    | a shown track always has at least one display                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [viewMenuActions](#getter-viewmenuactions)                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [canConfigure](#getter-canconfigure)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [adapterType](#getter-adaptertype)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [saveTrackDataMenuItem](#getter-savetrackdatamenuitem)           | Getters    | the "Save track data" menu entry. Kept separate from trackMenuItems so consumers (e.g. the LGV track-label menu) can place it alongside the session's Settings/Copy/Delete track actions without fishing it back out of the general list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [saveTrackFileFormatOptions](#method-savetrackfileformatoptions) | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [trackMenuItems](#method-trackmenuitems)                         | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [setPinned](#action-setpinned)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [setMinimized](#action-setminimized)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [replaceDisplay](#action-replacedisplay)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [afterAttach](#action-afterattach)                               | Actions    | Persist any config-schema mutation (quick track-menu edits calling `setSlot` directly, or the full Settings dialog) back to the session, debounced, mirroring ConfigurationEditorWidget's own save. `reaction` (not `autorun`) on purpose: `self.configuration` is defined immediately on attach, unlike ConfigurationEditorWidget's `target` (which starts undefined), so an autorun's guaranteed first run would otherwise schedule a spurious flush for every track ever shown, even completely untouched ones — `reaction` only fires on an actual change. `equals: comparer.structural` is load-bearing, not an optimization: `self.configuration` is a re-resolving reference, and persisting a save swaps the resolved node identity (admin `updateTrackConf` replaces the frozen `jbrowse.tracks` entry, rehydrating a brand-new MST node; the non-admin path reconciles in place but still churns once). Referential comparison would treat every such swap as a fresh change and re-fire the save, which for the admin/desktop path (new node every write) is an unbounded debounced loop. Structural comparison settles once the content stops changing. |

<details>
<summary>BaseTrackModel - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<string>
// code
type: types.literal(trackType)
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(baseTrackConfig)
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

#### property: pinned

```ts
// type signature
type pinned = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
pinned: types.stripDefault(types.boolean, false)
```

#### property: displays

```ts
// type signature
type displays = IArrayType<IAnyType>
// code
displays: types.array(pm.pluggableMstType('display', 'stateModel'))
```

</details>

<details>
<summary>BaseTrackModel - Getters</summary>

#### getter: rpcSessionId

determines which webworker to send the track to, currently based on trackId

```ts
type rpcSessionId = string
```

#### getter: activeDisplay

a shown track always has at least one display

```ts
type activeDisplay = any
```

#### getter: saveTrackDataMenuItem

the "Save track data" menu entry. Kept separate from trackMenuItems so consumers
(e.g. the LGV track-label menu) can place it alongside the session's
Settings/Copy/Delete track actions without fishing it back out of the general
list

```ts
type saveTrackDataMenuItem = MenuItem
```

</details>

<details>
<summary>BaseTrackModel - Getters (other undocumented members)</summary>

#### getter: trackId

```ts
type trackId = string
```

#### getter: name

```ts
type name = string
```

#### getter: textSearchAdapter

```ts
type textSearchAdapter = any
```

#### getter: adapterConfig

```ts
type adapterConfig = any
```

#### getter: viewMenuActions

```ts
type viewMenuActions = MenuItem[]
```

#### getter: canConfigure

```ts
type canConfigure = boolean
```

#### getter: adapterType

```ts
type adapterType = AdapterType
```

</details>

<details>
<summary>BaseTrackModel - Methods</summary>

#### method: saveTrackFileFormatOptions

```ts
type saveTrackFileFormatOptions = () => Record<string, FileTypeExporter>
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

</details>

<details>
<summary>BaseTrackModel - Actions</summary>

#### action: afterAttach

Persist any config-schema mutation (quick track-menu edits calling `setSlot`
directly, or the full Settings dialog) back to the session, debounced, mirroring
ConfigurationEditorWidget's own save. `reaction` (not `autorun`) on purpose:
`self.configuration` is defined immediately on attach, unlike
ConfigurationEditorWidget's `target` (which starts undefined), so an autorun's
guaranteed first run would otherwise schedule a spurious flush for every track
ever shown, even completely untouched ones — `reaction` only fires on an actual
change.

`equals: comparer.structural` is load-bearing, not an optimization:
`self.configuration` is a re-resolving reference, and persisting a save swaps
the resolved node identity (admin `updateTrackConf` replaces the frozen
`jbrowse.tracks` entry, rehydrating a brand-new MST node; the non-admin path
reconciles in place but still churns once). Referential comparison would treat
every such swap as a fresh change and re-fire the save, which for the
admin/desktop path (new node every write) is an unbounded debounced loop.
Structural comparison settles once the content stops changing.

```ts
type afterAttach = () => void
```

</details>

<details>
<summary>BaseTrackModel - Actions (other undocumented members)</summary>

#### action: setPinned

```ts
type setPinned = (flag: boolean) => void
```

#### action: setMinimized

```ts
type setMinimized = (flag: boolean) => void
```

#### action: replaceDisplay

```ts
type replaceDisplay = (
  oldDisplayId: string,
  newDisplayId: string,
  initialSnapshot?: any,
) => void
```

</details>
