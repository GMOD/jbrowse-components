---
id: spreadsheetview
title: SpreadsheetView
description: "Shows a VCF, BED, BEDPE or STAR-Fusion file as a filterable table whose rows open their genomic location in a new view."
sidebar_label: View -> SpreadsheetView
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `spreadsheet-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/SpreadsheetViewModel.ts).

Shows a VCF, BED, BEDPE or STAR-Fusion file as a filterable table whose
rows open their genomic location in a new view.

## Example usage

Hand-authored under `defaultSession.views`, with every setting written
directly on the view object. `uri` loads a VCF, BED, BEDPE or STAR-Fusion file
straight into the grid, skipping the import form; `assembly` names the
assembly that resolves genomic coordinates in the rows:

```js
{
  type: 'SpreadsheetView',
  assembly: 'hg38',
  uri: 'https://example.com/variants.vcf.gz',
  fileType: 'VCF',
}
```

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('SpreadsheetView')</code> |  |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> | the height of the sheet in pixels |
| <span id="property-hideverticalresizehandle">**hideVerticalResizeHandle**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, fal…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, false)</code></pre></dialog></span> | chrome switch, for an embed that sizes the view itself |
| <span id="property-drilldowntracks">**drilldownTracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>drilldownTracks: types.stripDefault(types.array(types.string),…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>drilldownTracks: types.stripDefault(types.array(types.string), [])</code></pre></dialog></span> | trackIds the views a row opens start with, beside the loaded file's own track: the tumor and normal alignments, a coverage track, an assembly's synteny track |
| <span id="property-importwizard">**importWizard**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>importWizard: types.optional(ImportWizardModel, () =&gt; ImportWiz…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>importWizard: types.optional(ImportWizardModel, () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;ImportWizardModel.create(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-spreadsheet">**spreadsheet**</span><br><code>spreadsheet: types.maybe(Spreadsheet())</code> |  |
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt; LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&gt;()</code></pre></dialog></span> | transient launch keys lifted off the view object, applied on attach and then cleared; author them directly on the view |

<details class="inherited-members" data-pagefind-ignore>
<summary>3 inherited properties from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="property-id">[`id`](../baseviewmodel#property-id)</span>, <span id="property-displayname">[`displayName`](../baseviewmodel#property-displayname)</span>, <span id="property-minimized">[`minimized`](../baseviewmodel#property-minimized)</span>

</details>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-width">**width**</span><br><code>number</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited volatile from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="volatile-bodymounted">[`bodyMounted`](../baseviewmodel#volatile-bodymounted)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;SpreadsheetViewCommands &amp; { unknown?: Record&lt;string…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;SpreadsheetViewCommands &amp; { unknown?: Record&lt;string, unknown&gt; &#124; undefined; malformed?: Record&lt;string, unknown&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; }&gt; &#124; undefined</code></pre></dialog></span> | the launch keys still waiting to be applied |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | true while the file loads, which `ViewContainer` publishes as `data-view-phase`; the import form stays on screen under a spinner |
| <span id="getter-drilldowntrackids">**drilldownTrackIds**</span><br><code>string[]</code> | every track a row's drill-down opens with, the loaded file's own first |

<details class="inherited-members" data-pagefind-ignore>
<summary>4 inherited getters from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="getter-rendersdisplays">[`rendersDisplays`](../baseviewmodel#getter-rendersdisplays)</span>, <span id="getter-effectivebodymounted">[`effectiveBodyMounted`](../baseviewmodel#getter-effectivebodymounted)</span>, <span id="getter-owntracks">[`ownTracks`](../baseviewmodel#getter-owntracks)</span>, <span id="getter-ownviews">[`ownViews`](../baseviewmodel#getter-ownviews)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menuitems">**menuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMa…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMap&lt;{}, "svg"&gt;&gt; &amp; { muiName: string; }; onClick: () =&gt; void; }[]</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> | returns the distance applied, which minHeight can cut short |
| <span id="action-displayspreadsheet">**displaySpreadsheet**</span><br><code>(spreadsheet?: SpreadsheetSnapshot) =&gt; void</code> | show a parsed sheet. One with the same columns as the sheet it replaces, as a reloaded session's re-fetch is, keeps that sheet's column visibility, filters and search |
| <span id="action-setlaunch">**setLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(launch?: LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined) =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(launch?: LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> | a failed launch's error, shown in the import form's banner |
| <span id="action-setdrilldowntracks">**setDrilldownTracks**</span><br><code>(trackIds: string[]) =&gt; void</code> |  |
| <span id="action-registerimportedtrack">**registerImportedTrack**</span><br><code>(assemblyName: string) =&gt; void</code> | Put the loaded file in the session as a track, so the views a row opens show the records it came from. Idempotent: a session that already has a track for the file reuses it.<br><br>Nothing removes the track, since the views that opened it outlive the sheet; the reader closes it like any session track. |
| <span id="action-loadspreadsheet">**loadSpreadsheet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string, superseded?: (() =&gt; boolean) &#124; undefined…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string, superseded?: (() =&gt; boolean) &#124; undefined) =&gt; Promise&lt;void&gt;</code></pre></dialog></span> | fetch, parse and show the wizard's file: the one path a launch, a session reload and the Open button all take |
| <span id="action-returntoimportform">**returnToImportForm**</span><br><code>() =&gt; void</code> | drop the sheet and its cached location, so a session reload does not fetch the dismissed file again |
| <span id="action-applyinit">**applyInit**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(init: LaunchInput&lt;SpreadsheetViewCommands&gt;, superseded?: (() =…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(init: LaunchInput&lt;SpreadsheetViewCommands&gt;, superseded?: (() =&gt; boolean) &#124; undefined) =&gt; Promise&lt;void&gt;</code></pre></dialog></span> | point the import wizard at a launch's file and load it; without a uri or an assembly, only seed the import form with what it names |

<details class="inherited-members" data-pagefind-ignore>
<summary>4 inherited actions from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="action-setdisplayname">[`setDisplayName`](../baseviewmodel#action-setdisplayname)</span>, <span id="action-setwidth">[`setWidth`](../baseviewmodel#action-setwidth)</span>, <span id="action-setbodymounted">[`setBodyMounted`](../baseviewmodel#action-setbodymounted)</span>, <span id="action-setminimized">[`setMinimized`](../baseviewmodel#action-setminimized)</span>

</details>
