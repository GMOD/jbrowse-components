---
id: importformsyntenymixin
title: ImportFormSyntenyMixin
sidebar_label: Mixin -> ImportFormSyntenyMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/ImportFormSyntenyMixin.ts).

The synteny track each row pair of a view's import form has picked, held on
the model so it outlives the form's per-pair remounts. Composed by the linear
synteny, dotplot and circular views.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-importformsyntenytrackselections">**importFormSyntenyTrackSelections**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>importFormSyntenyTrackSelections: observable.array&lt;ImportFormSy…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>importFormSyntenyTrackSelections:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;observable.array&lt;ImportFormSyntenyTrack&gt;()</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setimportformsyntenytrack">**setImportFormSyntenyTrack**</span><br><code>(idx: number, val: ImportFormSyntenyTrack) =&gt; void</code> |  |
| <span id="action-clearimportformsyntenytracks">**clearImportFormSyntenyTracks**</span><br><code>() =&gt; void</code> | Drop the pending selections once a launch has applied them. Left in place they outlive the form: "Return to import form" would reopen on a finished upload from the previous launch, and a pair whose assemblies no longer match it reads as an unfinished upload and disables Launch. |
