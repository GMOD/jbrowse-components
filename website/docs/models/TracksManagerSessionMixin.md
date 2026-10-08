---
id: tracksmanagersessionmixin
title: TracksManagerSessionMixin
description: "Properties, getters and actions of the TracksManagerSessionMixin state model."
sidebar_label: Mixin -> TracksManagerSessionMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Tracks.ts).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="property-id">[`id`](../basesessionmodel#property-id)</span>, <span id="property-name">[`name`](../basesessionmodel#property-name)</span>, <span id="property-focusedviewid">[`focusedViewId`](../basesessionmodel#property-focusedviewid)</span>, <span id="property-highlights">[`highlights`](../basesessionmodel#property-highlights)</span>, <span id="property-highlightsvisible">[`highlightsVisible`](../basesessionmodel#property-highlightsvisible)</span>, <span id="property-highlightlabelsvisible">[`highlightLabelsVisible`](../basesessionmodel#property-highlightlabelsvisible)</span>, <span id="property-heldformissingplugins">[`heldForMissingPlugins`](../basesessionmodel#property-heldformissingplugins)</span></span>

## Volatiles

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="volatile-selection">[`selection`](../basesessionmodel#volatile-selection)</span>, <span id="volatile-hovered">[`hovered`](../basesessionmodel#volatile-hovered)</span>, <span id="volatile-queueofdialogs">[`queueOfDialogs`](../basesessionmodel#volatile-queueofdialogs)</span>, <span id="volatile-preferencesoverrides">[`preferencesOverrides`](../basesessionmodel#volatile-preferencesoverrides)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="volatile-snackbarmessages">[`snackbarMessages`](../snackbarmodel#volatile-snackbarmessages)</span>, <span id="volatile-errordialog">[`errorDialog`](../snackbarmodel#volatile-errordialog)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-trackbasesbyid">**trackBasesById**</span><br><code>Map&lt;string, TrackConfigEntry&gt;</code> | Each track's base by trackId: the entry its edits diff against. Here the config.json entry, which an edit writes directly. |
| <span id="getter-tracks">**tracks**</span><br><code>TrackConfigEntry[]</code> |  |

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="getter-root">[`root`](../basesessionmodel#getter-root)</span>, <span id="getter-jbrowse">[`jbrowse`](../basesessionmodel#getter-jbrowse)</span>, <span id="getter-rpcmanager">[`rpcManager`](../basesessionmodel#getter-rpcmanager)</span>, <span id="getter-configuration">[`configuration`](../basesessionmodel#getter-configuration)</span>, <span id="getter-adminmode">[`adminMode`](../basesessionmodel#getter-adminmode)</span>, <span id="getter-textsearchmanager">[`textSearchManager`](../basesessionmodel#getter-textsearchmanager)</span>, <span id="getter-assemblies">[`assemblies`](../basesessionmodel#getter-assemblies)</span>, <span id="getter-dialogcomponent">[`DialogComponent`](../basesessionmodel#getter-dialogcomponent)</span>, <span id="getter-dialogprops">[`DialogProps`](../basesessionmodel#getter-dialogprops)</span>, <span id="getter-animationmode">[`animationMode`](../basesessionmodel#getter-animationmode)</span>, <span id="getter-scrollzoom">[`scrollZoom`](../basesessionmodel#getter-scrollzoom)</span>, <span id="getter-numbergrouping">[`numberGrouping`](../basesessionmodel#getter-numbergrouping)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="getter-snackbarmessageset">[`snackbarMessageSet`](../snackbarmodel#getter-snackbarmessageset)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-withtrackedits">**withTrackEdits**</span><br><code>(base: TrackConfigEntry) =&gt; TrackConfigEntry</code> | A track's base as the session resolves it, its edits applied. Here the base itself. |
| <span id="method-gettrackbyid">**getTrackById**</span><br><code>(id: string) =&gt; AnyTrackConfig &#124; undefined</code> | Config for one trackId — a track, assembly sequence, or connection track — or undefined. Per-id reactive: every display resolves its config through this (via TrackConfigurationReference) and subscribes only to its own id, so one track's settings edit doesn't re-render the others. |
| <span id="method-gettracksbyid">**getTracksById**</span><br><code>() =&gt; Record&lt;string, AnyTrackConfig&gt;</code> | Every track config the session can resolve, keyed by trackId. Prefer the per-id reactive `getTrackById(id)`: this map is rebuilt over every track on the first read after any edit, and reading it subscribes the caller to all of them. Kept for plugins that look up ids in a non-reactive context. |

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="method-getpreferencedefault">[`getPreferenceDefault`](../basesessionmodel#method-getpreferencedefault)</span>, <span id="method-getpreference">[`getPreference`](../basesessionmodel#method-getpreference)</span>, <span id="method-getpreferencechanges">[`getPreferenceChanges`](../basesessionmodel#method-getpreferencechanges)</span></span>

<span data-pagefind-ignore>From [ReferenceManagementSessionMixin](../referencemanagementsessionmixin): <span id="method-getreferringmultiple">[`getReferringMultiple`](../referencemanagementsessionmixin#method-getreferringmultiple)</span>, <span id="method-getreferring">[`getReferring`](../referencemanagementsessionmixin#method-getreferring)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-addsessiontrackconf">**addSessionTrackConf**</span><br><code>(trackConf: AnyConfiguration) =&gt; any</code> | Add a track config to *this session*.<br><br>This mixin's session has no separate session-track store, so the destination is the jbrowse config — which in the products that compose it (desktop) is the single user's own file rather than something a server hands other visitors, so the two scopes are the same place. Defined here anyway so that every session has it: a feature standing a track up on the user's behalf can then call one action everywhere instead of asking which mixin it landed on. `SessionTracksManagerSessionMixin` overrides it with the real session-scoped store. |
| <span id="action-publishtrackconf">**publishTrackConf**</span><br><code>(trackConf: AnyConfiguration) =&gt; any</code> | Add a track config wherever *this user's* catalog edits belong — the "Add track" workflows, where an admin adding a track means to add it for the whole site. `SessionTracksManagerSessionMixin` overrides it to send a non-admin's to the session instead; here there is only the one destination.<br><br>Anything that is not an Add-track workflow wants `addSessionTrackConf`: a track a feature stands up on the user's behalf — a search result, a computed consensus, a reconstruction's labels — is not a catalog entry, and publishing one writes it into the config.json every visitor is served, once per click. |
| <span id="action-addtrackconf">**addTrackConf**</span><br><code>(trackConf: AnyConfiguration) =&gt; any</code> | Deprecated alias of `addSessionTrackConf`. Call that, or `publishTrackConf`, which say which destination they mean. |
| <span id="action-updatetrackconfiguration">**updateTrackConfiguration**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; void</code></pre></dialog></span> | Persist edited track config back to the in-memory jbrowse config. The session-tracks mixin overrides this so a non-admin's edits become a shareable session-track override instead. |
| <span id="action-deletetrackconf">**deleteTrackConf**</span><br><code>(trackConf: AnyTrackConfig) =&gt; any</code> |  |

<span data-pagefind-ignore>From [BaseSessionModel](../basesessionmodel): <span id="action-setselection">[`setSelection`](../basesessionmodel#action-setselection)</span>, <span id="action-clearselection">[`clearSelection`](../basesessionmodel#action-clearselection)</span>, <span id="action-sethovered">[`setHovered`](../basesessionmodel#action-sethovered)</span>, <span id="action-sethighlightsvisible">[`setHighlightsVisible`](../basesessionmodel#action-sethighlightsvisible)</span>, <span id="action-sethighlightlabelsvisible">[`setHighlightLabelsVisible`](../basesessionmodel#action-sethighlightlabelsvisible)</span>, <span id="action-addhighlight">[`addHighlight`](../basesessionmodel#action-addhighlight)</span>, <span id="action-removehighlight">[`removeHighlight`](../basesessionmodel#action-removehighlight)</span>, <span id="action-updatehighlight">[`updateHighlight`](../basesessionmodel#action-updatehighlight)</span>, <span id="action-sethighlights">[`setHighlights`](../basesessionmodel#action-sethighlights)</span>, <span id="action-setpreferenceoverride">[`setPreferenceOverride`](../basesessionmodel#action-setpreferenceoverride)</span>, <span id="action-clearpreferenceoverrides">[`clearPreferenceOverrides`](../basesessionmodel#action-clearpreferenceoverrides)</span>, <span id="action-clearpreferenceoverride">[`clearPreferenceOverride`](../basesessionmodel#action-clearpreferenceoverride)</span>, <span id="action-setscrollzoom">[`setScrollZoom`](../basesessionmodel#action-setscrollzoom)</span>, <span id="action-setname">[`setName`](../basesessionmodel#action-setname)</span>, <span id="action-setfocusedviewid">[`setFocusedViewId`](../basesessionmodel#action-setfocusedviewid)</span>, <span id="action-removeactivedialog">[`removeActiveDialog`](../basesessionmodel#action-removeactivedialog)</span>, <span id="action-queuedialog">[`queueDialog`](../basesessionmodel#action-queuedialog)</span>, <span id="action-removedialog">[`removeDialog`](../basesessionmodel#action-removedialog)</span></span>

<span data-pagefind-ignore>From [SnackbarModel](../snackbarmodel): <span id="action-notify">[`notify`](../snackbarmodel#action-notify)</span>, <span id="action-notifyerror">[`notifyError`](../snackbarmodel#action-notifyerror)</span>, <span id="action-seterrordialog">[`setErrorDialog`](../snackbarmodel#action-seterrordialog)</span>, <span id="action-pushsnackbarmessage">[`pushSnackbarMessage`](../snackbarmodel#action-pushsnackbarmessage)</span>, <span id="action-popsnackbarmessage">[`popSnackbarMessage`](../snackbarmodel#action-popsnackbarmessage)</span>, <span id="action-removesnackbarmessage">[`removeSnackbarMessage`](../snackbarmodel#action-removesnackbarmessage)</span></span>

<span data-pagefind-ignore>From [ReferenceManagementSessionMixin](../referencemanagementsessionmixin): <span id="action-dereferencetrack">[`dereferenceTrack`](../referencemanagementsessionmixin#action-dereferencetrack)</span></span>
