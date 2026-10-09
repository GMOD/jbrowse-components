---
id: basesessionmodel
title: BaseSessionModel
description: "base session shared by all JBrowse products. Be careful what you include here, everything will use it."
sidebar_label: Session -> BaseSessionModel
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/BaseSession.ts).

base session shared by all JBrowse products. Be careful what you include
here, everything will use it.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-name">**name**</span><br><code>name: types.string</code> |  |
| <span id="property-focusedviewid">**focusedViewId**</span><br><code>focusedViewId: types.maybe(types.string)</code> | used to keep track of which view is in focus |
| <span id="property-highlights">**highlights**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>highlights: types.stripDefault( types.array(types.frozen&lt;Highli…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>highlights: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(types.frozen&lt;HighlightType&gt;()),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | translucent bands over genomic regions; every view draws the ones on its own assemblies |
| <span id="property-highlightsvisible">**highlightsVisible**</span><br><code>highlightsVisible: types.stripDefault(types.boolean, true)</code> |  |
| <span id="property-highlightlabelsvisible">**highlightLabelsVisible**</span><br><code>highlightLabelsVisible: types.stripDefault(types.boolean, true)</code> | whether a band's label is written on it |
| <span id="property-heldformissingplugins">**heldForMissingPlugins**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>heldForMissingPlugins: types.stripDefault( types.frozen&lt;HeldNod…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>heldForMissingPlugins: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.frozen&lt;HeldNode[] &#124; undefined&gt;(),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | views, tracks, displays and widgets `pruneUnbuildableNodes` took out of the tree because this build has no plugin for their type, each with the anchor that puts it back. Nothing in the session reads its contents, and `pruneUnbuildableNodes` defines their structure.<br><br>It is a **declared property** because MST drops undeclared snapshot keys without error. Without this declaration the held nodes survive the prune and are then discarded when `setSession` builds the tree, while every unit test of the prune still passes. `heldNodesSurviveTheSession.test.ts` tests that they survive. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-selection">**selection**</span><br><code>unknown</code> | this is the globally "selected" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is. |
| <span id="volatile-hovered">**hovered**</span><br><code>unknown</code> | this is the globally "hovered" object. can be anything. code that wants to deal with this should examine it to see what kind of thing it is. |
| <span id="volatile-queueofdialogs">**queueOfDialogs**</span><br><code>[DialogComponentType, Record&lt;string, unknown&gt;][]</code> |  |
| <span id="volatile-preferencesoverrides">**preferencesOverrides**</span><br><code>ObservableMap&lt;string, unknown&gt;</code> | runtime user-preference overrides keyed by preference id, resolved by `getPreference` against the `configuration.preferences` admin defaults. Empty here (config-only); products that let users edit preferences load and persist these via localStorage. A runtime override map layered over config defaults, kept off the snapshot since prefs are local UI.<br><br>An `observable.map` (not a plain object reassigned wholesale) so each preference is its own tracked key: writing one (`setScrollZoom`) can't invalidate a reader of another. A single spread-replaced object made every setter wake every reader, so toggling scroll-to-zoom re-fetched every track.<br><br>`deep: false` keeps an object-valued preference a plain object rather than a MobX Proxy, which V8's structured-clone serializer rejects. The map still notifies per key on `set`, so shallow values lose no reactivity — and nothing can mutate a preference in place, because `setPreferenceOverride` freezes what it stores. |

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="volatile-snackbarmessages">[`snackbarMessages`](../snackbarmodel#volatile-snackbarmessages)</span>, <span id="volatile-errordialog">[`errorDialog`](../snackbarmodel#volatile-errordialog)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-root">**root**</span><br><code>TypeOrStateTreeNodeToStateTreeNode&lt;ROOT_MODEL_TYPE&gt;</code> |  |
| <span id="getter-jbrowse">**jbrowse**</span><br><code>any</code> |  |
| <span id="getter-rpcmanager">**rpcManager**</span><br><code>RpcManager</code> |  |
| <span id="getter-configuration">**configuration**</span><br><code>Instance&lt;JB_CONFIG_SCHEMA&gt;</code> |  |
| <span id="getter-adminmode">**adminMode**</span><br><code>boolean</code> |  |
| <span id="getter-textsearchmanager">**textSearchManager**</span><br><code>TextSearchManager</code> |  |
| <span id="getter-assemblies">**assemblies**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ConfigNodeProps&lt;…&gt; &amp; ConfigNodeActions &amp; ConfigNodeBrand&lt;Confi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ConfigNodeProps&lt;…&gt; &amp; ConfigNodeActions &amp; ConfigNodeBrand&lt;ConfigurationSchemaType&lt;…&gt;&gt;)[]</code></pre></dialog></span> |  |
| <span id="getter-dialogcomponent">**DialogComponent**</span><br><code>DialogComponentType</code> |  |
| <span id="getter-dialogprops">**DialogProps**</span><br><code>Record&lt;string, unknown&gt;</code> |  |
| <span id="getter-animationmode">**animationMode**</span><br><code>AnimationMode</code> | resolved feature-layout animation mode (never undefined) |
| <span id="getter-scrollzoom">**scrollZoom**</span><br><code>boolean</code> | resolved scroll-to-zoom preference. Global and personal (never shared in a session snapshot); every wheel-zoom view reads this single value. |
| <span id="getter-numbergrouping">**numberGrouping**</span><br><code>boolean</code> | resolved thousand-separator preference. Read for display in the Preferences dialog; the formatter itself reads a plain module variable set at startup in each realm (see `setNumberGrouping`), because worker- built strings can't see a main-thread observable. |

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="getter-snackbarmessageset">[`snackbarMessageSet`](../snackbarmodel#getter-snackbarmessageset)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-getpreferencedefault">**getPreferenceDefault**</span><br><code>(key: string) =&gt; unknown</code> | the admin/embedder `configuration.preferences` value for a key, ignoring any runtime override — i.e. what a reset falls back to |
| <span id="method-getpreference">**getPreference**</span><br><code>(key: string) =&gt; unknown</code> | resolved value of a user preference: a runtime override if the user set one, otherwise the admin/embedder `configuration.preferences` default. The override map is empty unless the product loads it (web/desktop). |
| <span id="method-getpreferencechanges">**getPreferenceChanges**</span><br><code>() =&gt; TrackConfigChange[]</code> | every scalar preference override that currently differs from its config/admin default, as `{ path, from, to }` rows whose path is the override's own key. A scalar pref (animationMode, scrollZoom) whose override equals the default is omitted, since reverting it is a no-op. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setselection">**setSelection**</span><br><code>(thing: unknown) =&gt; void</code> | set the global selection, i.e. the globally-selected object. can be a feature, a view, just about anything<br><br>A feature is unwrapped on the way in, so app state never holds a jexlFeatureProxy. `isFeature` accepts a proxy, but on one `id` is a data field rather than the method the Feature type promises — every consumer doing `isFeature(selection) ? selection.id() : …` would throw. |
| <span id="action-clearselection">**clearSelection**</span><br><code>() =&gt; void</code> | clears the global selection |
| <span id="action-sethovered">**setHovered**</span><br><code>(thing: unknown) =&gt; void</code> |  |
| <span id="action-sethighlightsvisible">**setHighlightsVisible**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-sethighlightlabelsvisible">**setHighlightLabelsVisible**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-addhighlight">**addHighlight**</span><br><code>(highlight: HighlightType) =&gt; void</code> | an identical entry is not added twice, so a spec launched again does not stack its bands. Adding shows the bands again, since a highlight made while they are off would otherwise read as nothing happening |
| <span id="action-removehighlight">**removeHighlight**</span><br><code>(highlight: HighlightType) =&gt; void</code> |  |
| <span id="action-updatehighlight">**updateHighlight**</span><br><code>(old: HighlightType, updates: Partial&lt;HighlightType&gt;) =&gt; void</code> |  |
| <span id="action-sethighlights">**setHighlights**</span><br><code>(highlights: HighlightType[]) =&gt; void</code> |  |
| <span id="action-setpreferenceoverride">**setPreferenceOverride**</span><br><code>(key: string, value: unknown) =&gt; void</code> | set a runtime user-preference override (see `getPreference`). Mutates volatile state; products persist these to localStorage. An `undefined` value deletes the key (rather than leaving a phantom entry that `getPreference` reads as absent) so the store never holds dead keys. |
| <span id="action-clearpreferenceoverrides">**clearPreferenceOverrides**</span><br><code>() =&gt; void</code> | clear every runtime preference override at once, so each falls back to its config/admin default. Backs the Preferences dialog "Reset to defaults" button. |
| <span id="action-clearpreferenceoverride">**clearPreferenceOverride**</span><br><code>(key: string) =&gt; void</code> | clear a single runtime preference override (see `getPreference`) so it falls back to its config/admin default. Backs the per-entry reset in the Preferences dialog "Reset to defaults" confirmation. |
| <span id="action-setscrollzoom">**setScrollZoom**</span><br><code>(flag: boolean) =&gt; void</code> | set the global scroll-to-zoom preference (see the `scrollZoom` getter) |
| <span id="action-setname">**setName**</span><br><code>(str: string) =&gt; void</code> |  |
| <span id="action-setfocusedviewid">**setFocusedViewId**</span><br><code>(viewId: string &#124; undefined) =&gt; void</code> | `undefined` is "no view is focused", which the property has always been able to hold (`types.maybe`) and this had no way to spell. Nothing cleared it on teardown as a result: a view that was focused when it left the session left its id behind, and since every consumer compares `focusedViewId === view.id`, the id matched nothing, the focus ring vanished with nothing to say why, and the dead id persisted into a saved or shared session. `takeOut` clears it now. |
| <span id="action-removeactivedialog">**removeActiveDialog**</span><br><code>() =&gt; void</code> | Dismiss the dialog on screen as its own close button would, so a dialog that settles a promise on close (an internet account's token prompt) settles it, and drop it from the queue if it did not. |
| <span id="action-queuedialog">**queueDialog**</span><br><code>(doneCallback: DoneCallback) =&gt; void</code> |  |
| <span id="action-removedialog">**removeDialog**</span><br><code>(entry: [DialogComponentType, Record&lt;string, unknown&gt;]) =&gt; void</code> |  |

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="action-notify">[`notify`](../snackbarmodel#action-notify)</span>, <span id="action-notifyerror">[`notifyError`](../snackbarmodel#action-notifyerror)</span>, <span id="action-seterrordialog">[`setErrorDialog`](../snackbarmodel#action-seterrordialog)</span>, <span id="action-pushsnackbarmessage">[`pushSnackbarMessage`](../snackbarmodel#action-pushsnackbarmessage)</span>, <span id="action-popsnackbarmessage">[`popSnackbarMessage`](../snackbarmodel#action-popsnackbarmessage)</span>, <span id="action-removesnackbarmessage">[`removeSnackbarMessage`](../snackbarmodel#action-removesnackbarmessage)</span></span>
