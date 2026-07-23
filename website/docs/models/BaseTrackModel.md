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

| Member                                                           | Kind       | Defined by     | Description                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                               | Properties | BaseTrackModel |                                                                                                                                                                                                     |
| [type](#property-type)                                           | Properties | BaseTrackModel |                                                                                                                                                                                                     |
| [configuration](#property-configuration)                         | Properties | BaseTrackModel |                                                                                                                                                                                                     |
| [minimized](#property-minimized)                                 | Properties | BaseTrackModel |                                                                                                                                                                                                     |
| [pinned](#property-pinned)                                       | Properties | BaseTrackModel |                                                                                                                                                                                                     |
| [displays](#property-displays)                                   | Properties | BaseTrackModel | The runtime plugin union (`pluggableMstType`) is typed only as `IAnyType`, erasing the element to `any`.                                                                                            |
| [trackId](#getter-trackid)                                       | Getters    | BaseTrackModel |                                                                                                                                                                                                     |
| [rpcSessionId](#getter-rpcsessionid)                             | Getters    | BaseTrackModel | determines which webworker to send the track to, currently based on trackId                                                                                                                         |
| [name](#getter-name)                                             | Getters    | BaseTrackModel |                                                                                                                                                                                                     |
| [textSearchAdapter](#getter-textsearchadapter)                   | Getters    | BaseTrackModel |                                                                                                                                                                                                     |
| [adapterConfig](#getter-adapterconfig)                           | Getters    | BaseTrackModel |                                                                                                                                                                                                     |
| [activeDisplay](#getter-activedisplay)                           | Getters    | BaseTrackModel | a shown track always has at least one display                                                                                                                                                       |
| [canConfigure](#getter-canconfigure)                             | Getters    | BaseTrackModel |                                                                                                                                                                                                     |
| [adapterType](#getter-adaptertype)                               | Getters    | BaseTrackModel |                                                                                                                                                                                                     |
| [saveTrackDataMenuItem](#getter-savetrackdatamenuitem)           | Getters    | BaseTrackModel | the "Save track data" menu entry.                                                                                                                                                                   |
| [saveTrackFileFormatOptions](#method-savetrackfileformatoptions) | Methods    | BaseTrackModel |                                                                                                                                                                                                     |
| [trackMenuItems](#method-trackmenuitems)                         | Methods    | BaseTrackModel |                                                                                                                                                                                                     |
| [setPinned](#action-setpinned)                                   | Actions    | BaseTrackModel |                                                                                                                                                                                                     |
| [setMinimized](#action-setminimized)                             | Actions    | BaseTrackModel |                                                                                                                                                                                                     |
| [replaceDisplay](#action-replacedisplay)                         | Actions    | BaseTrackModel |                                                                                                                                                                                                     |
| [afterAttach](#action-afterattach)                               | Actions    | BaseTrackModel | Persist any config-schema mutation (quick track-menu edits calling `setSlot` directly, or the full Settings dialog) back to the session, debounced, mirroring ConfigurationEditorWidget's own save. |

<details>
<summary>BaseTrackModel - Properties</summary>

#### property: displays

The runtime plugin union (`pluggableMstType`) is typed only as `IAnyType`,
erasing the element to `any`. Assert the concrete `DisplayModel` instance every
registered display satisfies so reads (`activeDisplay`, `trackMenuItems`) are
checked; create/snapshot stay `unknown` since the union's snapshot shape is
genuinely dynamic (`replaceDisplay` writes a partial snapshot).

```ts
// type signature
type displays = IArrayType<IType<unknown, unknown, DisplayModel>>
// code
displays: types.array(
  pm.pluggableMstType('display', 'stateModel') as unknown as IType<
    unknown,
    unknown,
    DisplayModel
  >,
)
```

</details>

<details>
<summary>BaseTrackModel - Properties (other undocumented members)</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>`    |
| <span id="property-type">type</span>                   | `ISimpleType<string>`                                 |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<AnyConfigurationSchemaType>` |
| <span id="property-minimized">minimized</span>         | `IOptionalIType<ISimpleType<boolean>, [undefined]>`   |
| <span id="property-pinned">pinned</span>               | `IOptionalIType<ISimpleType<boolean>, [undefined]>`   |

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
type activeDisplay = DisplayModel &
  IStateTreeNode<IType<unknown, unknown, DisplayModel>>
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

| Member                                                       | Type          |
| ------------------------------------------------------------ | ------------- |
| <span id="getter-trackid">trackId</span>                     | `string`      |
| <span id="getter-name">name</span>                           | `string`      |
| <span id="getter-textsearchadapter">textSearchAdapter</span> | `any`         |
| <span id="getter-adapterconfig">adapterConfig</span>         | `any`         |
| <span id="getter-canconfigure">canConfigure</span>           | `boolean`     |
| <span id="getter-adaptertype">adapterType</span>             | `AdapterType` |

</details>

<details>
<summary>BaseTrackModel - Methods</summary>

| Member                                                                         | Type                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------- |
| <span id="method-savetrackfileformatoptions">saveTrackFileFormatOptions</span> | `() => Record<string, FileTypeExporter>` |
| <span id="method-trackmenuitems">trackMenuItems</span>                         | `() => MenuItem[]`                       |

</details>

<details>
<summary>BaseTrackModel - Actions</summary>

#### action: afterAttach

Persist any config-schema mutation (quick track-menu edits calling `setSlot`
directly, or the full Settings dialog) back to the session, debounced, mirroring
ConfigurationEditorWidget's own save. Both savers intentionally coexist — this
one covers direct setSlot edits on a shown track, the widget covers an unshown
track edited from the selector (no BaseTrackModel). When both fire they compute
an identical delta, deduped in updateTrackConfiguration; don't drop one to
"simplify". `reaction` (not `autorun`) on purpose: `self.configuration` is
defined immediately on attach, unlike ConfigurationEditorWidget's `target`
(which starts undefined), so an autorun's guaranteed first run would otherwise
schedule a spurious flush for every track ever shown, even completely untouched
ones — `reaction` only fires on an actual change.

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

| Member                                                 | Type                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| <span id="action-setpinned">setPinned</span>           | `(flag: boolean) => void`                                                     |
| <span id="action-setminimized">setMinimized</span>     | `(flag: boolean) => void`                                                     |
| <span id="action-replacedisplay">replaceDisplay</span> | `(oldDisplayId: string, newDisplayId: string, initialSnapshot?: any) => void` |

</details>
