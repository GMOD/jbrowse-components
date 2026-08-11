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

Hand-authored under `defaultSession.views`. The `init` shorthand loads a tabular
file (VCF/BED/CSV/etc) straight into the grid, skipping the import form;
`assembly` is used to resolve genomic coordinates in the rows:

```js
{
  type: 'SpreadsheetView',
  init: {
    assembly: 'hg38',
    uri: 'https://example.com/variants.vcf.gz',
    fileType: 'VCF',
  },
}
```

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('SpreadsheetView')</code> |  | SpreadsheetView |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> |  | SpreadsheetView |
| <span id="property-hideverticalresizehandle">**hideVerticalResizeHandle**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, fal…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, false)</code></pre></dialog></span> |  | SpreadsheetView |
| <span id="property-importwizard">**importWizard**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>importWizard: types.optional(ImportWizardModel, () =&gt; ImportWiz…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>importWizard: types.optional(ImportWizardModel, () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;ImportWizardModel.create(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | SpreadsheetView |
| <span id="property-spreadsheet">**spreadsheet**</span><br><code>spreadsheet: types.maybe(Spreadsheet())</code> |  | SpreadsheetView |
| <span id="property-init">**init**</span><br><code>init: types.frozen&lt;SpreadsheetViewInit &#124; undefined&gt;()</code> | used for initializing the view from a session snapshot | SpreadsheetView |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseViewModel](../baseviewmodel#property-id) |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  | [BaseViewModel](../baseviewmodel#property-minimized) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-width">**width**</span><br><code>width: 400</code> |  |

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
| <span id="action-setinit">**setInit**</span><br><code>(init?: SpreadsheetViewInit &#124; undefined) =&gt; void</code> |  | SpreadsheetView |
| <span id="action-loadspreadsheet">**loadSpreadsheet**</span><br><code>(assemblyName: string) =&gt; Promise&lt;void&gt;</code> | the single load funnel: fetch+parse via the import wizard, then display the result. Every entry point (declarative init, cached reload, the import form's Open button) routes through here so the view stays the sole owner of displaySpreadsheet | SpreadsheetView |
| <span id="action-returntoimportform">**returnToImportForm**</span><br><code>() =&gt; void</code> | drop the loaded sheet and the cached location together: leaving the cache behind makes afterAttach re-fetch the dismissed file on the next session load, putting the user back where they left | SpreadsheetView |
| <span id="action-applyinit">**applyInit**</span><br><code>(init: SpreadsheetViewInit) =&gt; Promise&lt;void&gt;</code> | apply a declarative init (from addView / sv-inspector): point the import wizard at the file and load it. Without a uri there is nothing to load, so the wizard is only seeded — the import form then opens on the caller's assembly and file type instead of whichever assembly happens to sort first | SpreadsheetView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> | <span data-pagefind-ignore>width is an important attribute of the view model, when it becomes set, it often indicates when the app can start drawing to it. certain views like lgv are strict about this because if it tries to draw before it knows the width it should draw to, it may start fetching data for regions it doesn't need to<br><br>setWidth is updated by a ResizeObserver generally, the views often need to know how wide they are to properly draw genomic regions</span> | [BaseViewModel](../baseviewmodel#action-setwidth) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
