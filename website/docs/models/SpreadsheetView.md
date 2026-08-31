---
id: spreadsheetview
title: SpreadsheetView
sidebar_label: View -> SpreadsheetView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`spreadsheet-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/SpreadsheetView/SpreadsheetViewModel.ts).

## Example usage

Hand-authored under `defaultSession.views`, with every setting written directly
on the view object. `uri` loads a tabular file (VCF/BED/CSV/etc) straight into
the grid, skipping the import form; `assembly` is used to resolve genomic
coordinates in the rows:

```js
{
  type: 'SpreadsheetView',
  assembly: 'hg38',
  uri: 'https://example.com/variants.vcf.gz',
  fileType: 'VCF',
}
```

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('SpreadsheetView')</code> |  | SpreadsheetView |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> | the height of the sheet in pixels | SpreadsheetView |
| <span id="property-hideverticalresizehandle">**hideVerticalResizeHandle**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, fal…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, false)</code></pre></dialog></span> | chrome switch, for an embed that sizes the view itself | SpreadsheetView |
| <span id="property-importwizard">**importWizard**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>importWizard: types.optional(ImportWizardModel, () =&gt; ImportWiz…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>importWizard: types.optional(ImportWizardModel, () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;ImportWizardModel.create(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | SpreadsheetView |
| <span id="property-spreadsheet">**spreadsheet**</span><br><code>spreadsheet: types.maybe(Spreadsheet())</code> |  | SpreadsheetView |
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt; LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&gt;()</code></pre></dialog></span> | transient launch state: the settings written on the view object that need resolving before they can be view state — the file to load, the assembly its rows are read against, the filter to open it under. `preProcessSnapshot` moves them here off the snapshot, the afterAttach reaction applies them and clears this, so a saved session never retains it. Not written by hand: author every setting directly on the view. | SpreadsheetView |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseViewModel](../baseviewmodel#property-id) |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> | <span data-pagefind-ignore>collapse the view to its header bar, keeping it in the session rather than closing it</span> | [BaseViewModel](../baseviewmodel#property-minimized) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-width">**width**</span><br><code>width: 400</code> |  | SpreadsheetView |
| <span id="volatile-bodymounted">**bodyMounted**</span><br><code>bodyMounted: true</code> | <span data-pagefind-ignore>Whether the container has this view's body in the DOM.<br><br>`ViewContainer` mounts a view's body only while an IntersectionObserver says it is on screen, to hold the app under the WebGL2 context ceiling (`reference/GPU_CONTEXT_BUDGET.md`). A view below the fold therefore has no canvas, so nothing ever calls `markCanvasDrawn` and the pre-first-paint term of `displayPhase` pins every display in it at `loading` with nothing left to resolve it — which parks `[data-app-phase="ready"]` for the whole app on a view the user cannot see.<br><br>Defaults true so the containers that always mount a body — embedded views, workspace panels, and any test rendering a display directly — are unaffected and need not set it.<br><br>The raw flag, written by this view's own container. A display asks `effectiveBodyMounted` instead, because a nested view has no container of its own.</span> | [BaseViewModel](../baseviewmodel#volatile-bodymounted) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-init">**init**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;SpreadsheetViewCommands &amp; { unknown?: Record&lt;…&gt; &#124; u…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;SpreadsheetViewCommands &amp; { unknown?: Record&lt;…&gt; &#124; undefined; malformed?: Record&lt;…&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; } &amp; IStateTreeNode&lt;...&gt;&gt; &#124; undefined</code></pre></dialog></span> | the launch state that still has something to apply — the gate the afterAttach reaction reads. Also v4's name for it, kept while the other views and the products that drive them still spell it this way; deleted with `setInit`. | SpreadsheetView |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Named to match LGV/dotplot/synteny/circular/breakpoint-split, which is what `ViewContainer` reads to publish `data-view-phase`. Without it this view published `ready` for its whole load, so a capture or a browser test waiting on that attribute treated a spreadsheet still fetching and parsing its VCF as settled — and there is no display-level wait to fall back on here, since a spreadsheet mounts no displays at all.<br><br>The one view whose loading state renders *inside* its import form rather than replacing it: the wizard keeps the chosen file, type and assembly on screen and puts a spinner above them, which is more useful than a bare loading screen that throws that context away. The phase is about the model, not about which component is mounted. | SpreadsheetView |
| <span id="getter-importedtrackid">**importedTrackId**</span><br><code>any</code> | the track showing the loaded file, which the views a row drills down into open. One derivation, not a recorded id: after `registerImportedTrack` the session holds a track pointing at the file, so the same location match that decides whether to build one is also what finds it afterwards | SpreadsheetView |
| <span id="getter-effectivebodymounted">**effectiveBodyMounted**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether this view's body is in the DOM, counting the views it is nested inside — which is the question a display's phase actually asks.<br><br>`bodyMounted` alone answers it only for a view a container renders directly. A view nested in another view (a synteny row, a breakpoint panel) has no container writing its flag, so it reads `true` forever while its whole subtree is out of the DOM, and every display in it waits for a first paint that nothing will make — the hang this flag exists to prevent, one level down.<br><br>An ancestor that does not carry the flag at all leaves the answer alone rather than excusing the paint: only an explicit `false` unmounts, so a duck-typed stand-in that forgot it keeps waiting, which is the failure that shows up as a slow test rather than as a picture of an empty view.</span> | [BaseViewModel](../baseviewmodel#getter-effectivebodymounted) |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menuitems">**menuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMa…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMap&lt;{}, "svg"&gt;&gt; &amp; { muiName: string; }; onClick: () =&gt; void; }[]</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  | SpreadsheetView |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> | returns the distance actually applied, which is less than the requested one once the drag runs into minHeight — the ResizeHandle needs that to keep the bar under the pointer | SpreadsheetView |
| <span id="action-displayspreadsheet">**displaySpreadsheet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(spreadsheet?: ModelCreationType&lt;ExtractCFromProps&lt;…&gt;&gt; &#124; undefi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(spreadsheet?: ModelCreationType&lt;ExtractCFromProps&lt;…&gt;&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> | load a new spreadsheet and set our mode to display it. When the incoming data has the same columns as what's shown (i.e. a session-cached URI being re-fetched on reload), carry over the user's column-visibility and SV-type filter — a fresh parse only supplies columns/rowSet, so a plain replace would reset them. The column match keeps this from leaking view state across different files. | SpreadsheetView |
| <span id="action-setinit">**setInit**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(init?: LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(init?: LaunchInput&lt;SpreadsheetViewCommands&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> |  | SpreadsheetView |
| <span id="action-registerimportedtrack">**registerImportedTrack**</span><br><code>(assemblyName: string) =&gt; void</code> | Put the loaded file in the session as a track, so the linear and breakpoint views a row opens have the records the row came from. Without it every drill-down landed on an empty view and the reader had to add the same file again by hand.<br><br>Idempotent on purpose, and cheaply so: the trackId is derived from the file's location and `addSessionTrackConf` dedupes against everything the session can already resolve, so a reloaded session re-importing its cached URI reuses the track rather than stacking a second one. `trackConfForImportedFile` declines outright when a track for the file already exists.<br><br>**Nothing takes the track back out** — not `returnToImportForm`, not closing this view. The views that opened it are the reason it exists and they outlive the sheet, so removing it would empty a linear view the reader is still reading. It is an ordinary session track from that point on: it shows up in the track selector, it saves with the session, and the reader closes it there. Importing a second file adds a second track rather than replacing this one, which is the same answer — they loaded two files. | SpreadsheetView |
| <span id="action-loadspreadsheet">**loadSpreadsheet**</span><br><code>(assemblyName: string) =&gt; Promise&lt;void&gt;</code> | the single load funnel: fetch+parse via the import wizard, then display the result. Every entry point (declarative init, cached reload, the import form's Open button) routes through here so the view stays the sole owner of displaySpreadsheet | SpreadsheetView |
| <span id="action-returntoimportform">**returnToImportForm**</span><br><code>() =&gt; void</code> | drop the loaded sheet and the cached location together: leaving the cache behind makes afterAttach re-fetch the dismissed file on the next session load, putting the user back where they left | SpreadsheetView |
| <span id="action-applyinit">**applyInit**</span><br><code>(init: LaunchInput&lt;SpreadsheetViewCommands&gt;) =&gt; Promise&lt;void&gt;</code> | apply a declarative init (from addView / sv-inspector): point the import wizard at the file and load it. Without a uri there is nothing to load, so the wizard is only seeded — the import form then opens on the caller's assembly and file type instead of whichever assembly happens to sort first | SpreadsheetView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> | <span data-pagefind-ignore>width is an important attribute of the view model, when it becomes set, it often indicates when the app can start drawing to it. certain views like lgv are strict about this because if it tries to draw before it knows the width it should draw to, it may start fetching data for regions it doesn't need to<br><br>setWidth is updated by a ResizeObserver generally, the views often need to know how wide they are to properly draw genomic regions</span> | [BaseViewModel](../baseviewmodel#action-setwidth) |
| <span id="action-setbodymounted">**setBodyMounted**</span><br><code>(flag: boolean) =&gt; void</code> | <span data-pagefind-ignore>See `bodyMounted`. Written by the view's container, which is the only thing that knows whether it rendered the body.</span> | [BaseViewModel](../baseviewmodel#action-setbodymounted) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
