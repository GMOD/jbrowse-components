---
id: spreadsheetview
title: SpreadsheetView
description: "Shows a tabular file, such as a VCF, BED or CSV, as a filterable table whose rows open their genomic location in a new view."
sidebar_label: View -> SpreadsheetView
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `spreadsheet-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/SpreadsheetViewModel.ts).

Shows a tabular file, such as a VCF, BED or CSV, as a filterable table whose
rows open their genomic location in a new view.

## Example usage

Hand-authored under `defaultSession.views`, with every setting written
directly on the view object. `uri` loads a tabular file (VCF/BED/CSV/etc)
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
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt; LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&gt;()</code></pre></dialog></span> | transient launch state: the settings written on the view object that need resolving before they can be view state — the file to load, the assembly its rows are read against, the filter to open it under. `preProcessSnapshot` moves them here off the snapshot, the afterAttach reaction applies them and clears this, so a saved session never retains it. Not written by hand: author every setting directly on the view. |

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
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;SpreadsheetViewCommands &amp; { unknown?: Record&lt;string…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;SpreadsheetViewCommands &amp; { unknown?: Record&lt;string, unknown&gt; &#124; undefined; malformed?: Record&lt;string, unknown&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; } &amp; IStateTreeNode&lt;IType&lt;LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined, LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined, LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined&gt;&gt;&gt; &#124; undefined</code></pre></dialog></span> | the launch state that still has something to apply — the gate the afterAttach reaction reads. |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Named to match LGV/dotplot/synteny/circular/breakpoint-split, which is what `ViewContainer` reads to publish `data-view-phase`. Without it this view published `ready` for its whole load, so a capture or a browser test waiting on that attribute treated a spreadsheet still fetching and parsing its VCF as settled — and there is no display-level wait to fall back on here, since a spreadsheet mounts no displays at all.<br><br>The one view whose loading state renders *inside* its import form rather than replacing it: the wizard keeps the chosen file, type and assembly on screen and puts a spinner above them, which is more useful than a bare loading screen that throws that context away. The phase is about the model, not about which component is mounted. |
| <span id="getter-drilldowntrackids">**drilldownTrackIds**</span><br><code>string[]</code> | every track a row's drill-down opens with, the loaded file's first. That one is derived, not recorded: after `registerImportedTrack` the session holds a track pointing at the file, so the location match that decides whether to build one also finds it afterwards |

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
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> | returns the distance actually applied, which is less than the requested one once the drag runs into minHeight — the ResizeHandle needs that to keep the bar under the pointer |
| <span id="action-displayspreadsheet">**displaySpreadsheet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(spreadsheet?: ModelCreationType&lt;ExtractCFromProps&lt;{ rowSet: IT…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(spreadsheet?: ModelCreationType&lt;ExtractCFromProps&lt;{ rowSet: IType&lt;RowSet &#124; undefined, RowSet &#124; undefined, RowSet &#124; undefined&gt;; columns: IOptionalIType&lt;IType&lt;{ name: string; }[], { name: string; }[], { name: string; }[]&gt;, [undefined]&gt;; assemblyName: IMaybe&lt;ISimpleType&lt;string&gt;&gt;; visibleColumns: IOptionalIType&lt;IType&lt;Record&lt;string, boolean&gt;, Record&lt;string, boolean&gt;, Record&lt;string, boolean&gt;&gt;, [undefined]&gt;; svTypeFilter: IMaybe&lt;ISimpleType&lt;string&gt;&gt;; svEventFilter: IMaybe&lt;ISimpleType&lt;string&gt;&gt;; filterText: IMaybe&lt;ISimpleType&lt;string&gt;&gt;; }&gt;&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> | load a new spreadsheet and set our mode to display it. When the incoming data has the same columns as what's shown (i.e. a session-cached URI being re-fetched on reload), keep the user's column-visibility and SV-type filter — a fresh parse only supplies columns/rowSet, so a plain replace would reset them. The column match keeps this from leaking view state across different files. |
| <span id="action-setlaunch">**setLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(launch?: LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined) =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(launch?: LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> | Receives the error of a failed launch, which `installInitAutorun` requires of its host. It delegates to the import form rather than adding a separate slot: the import form is on screen before a sheet exists, and its banner is already the one place this view shows an error. |
| <span id="action-setdrilldowntracks">**setDrilldownTracks**</span><br><code>(trackIds: string[]) =&gt; void</code> |  |
| <span id="action-registerimportedtrack">**registerImportedTrack**</span><br><code>(assemblyName: string) =&gt; void</code> | Put the loaded file in the session as a track, so the linear and breakpoint views a row opens have the records the row came from. Without it every drill-down opens an empty view and the reader has to add the same file again by hand.<br><br>The action is idempotent, and cheaply so: the trackId is derived from the file's location and `addSessionTrackConf` dedupes against everything the session can already resolve, so a reloaded session re-importing its cached URI reuses the track rather than stacking a second one. `trackConfForImportedFile` declines outright when a track for the file already exists.<br><br>**No code removes the track**, neither `returnToImportForm` nor closing this view. The views that opened it need the track and they outlive the sheet, so removing it would empty a linear view the reader is still reading. It is an ordinary session track from that point on: it shows up in the track selector, it saves with the session, and the reader closes it there. Importing a second file adds a second track rather than replacing this one, which is the same answer — they loaded two files. |
| <span id="action-loadspreadsheet">**loadSpreadsheet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string, superseded?: (() =&gt; boolean) &#124; undefined…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string, superseded?: (() =&gt; boolean) &#124; undefined) =&gt; Promise&lt;void&gt;</code></pre></dialog></span> | the single load funnel: fetch+parse via the import wizard, then display the result. Every entry point (declarative init, cached reload, the import form's Open button) routes through here so the view stays the sole owner of displaySpreadsheet |
| <span id="action-returntoimportform">**returnToImportForm**</span><br><code>() =&gt; void</code> | drop the loaded sheet and the cached location together: leaving the cache behind makes afterAttach re-fetch the dismissed file on the next session load, putting the user back where they left |
| <span id="action-applyinit">**applyInit**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(init: LaunchInput&lt;SpreadsheetViewCommands&gt;, superseded?: (() =…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(init: LaunchInput&lt;SpreadsheetViewCommands&gt;, superseded?: (() =&gt; boolean) &#124; undefined) =&gt; Promise&lt;void&gt;</code></pre></dialog></span> | apply a declarative init (from addView / sv-inspector): point the import wizard at the file and load it. Without a uri there is nothing to load, so the wizard is only seeded — the import form then opens on the caller's assembly and file type instead of whichever assembly happens to sort first |

<details class="inherited-members" data-pagefind-ignore>
<summary>4 inherited actions from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="action-setdisplayname">[`setDisplayName`](../baseviewmodel#action-setdisplayname)</span>, <span id="action-setwidth">[`setWidth`](../baseviewmodel#action-setwidth)</span>, <span id="action-setbodymounted">[`setBodyMounted`](../baseviewmodel#action-setbodymounted)</span>, <span id="action-setminimized">[`setMinimized`](../baseviewmodel#action-setminimized)</span>

</details>
