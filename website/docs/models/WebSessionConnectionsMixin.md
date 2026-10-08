---
id: websessionconnectionsmixin
title: WebSessionConnectionsMixin
description: "Properties, getters and actions of the WebSessionConnectionsMixin state model."
sidebar_label: Mixin -> WebSessionConnectionsMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/SessionConnections.ts).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-sessionconnections">**sessionConnections**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>sessionConnections: types.stripDefault( types.array(pluginManag…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>sessionConnections: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(pluginManager.pluggableConfigSchemaType('connection')),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |

<span data-pagefind-ignore>From [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin): <span id="property-connectioninstances">[`connectionInstances`](../connectionmanagementsessionmixin#property-connectioninstances)</span>, <span id="property-connectiontrackconfigs">[`connectionTrackConfigs`](../connectionmanagementsessionmixin#property-connectiontrackconfigs)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-connections">**connections**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ConfigNodeProps&lt;…&gt; &amp; ConfigNodeActions &amp; ConfigNodeBrand&lt;Confi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ConfigNodeProps&lt;…&gt; &amp; ConfigNodeActions &amp; ConfigNodeBrand&lt;ConfigurationSchemaType&lt;{ readonly name: { type: "string"; } &amp; { defaultValue: string; }; readonly assemblyNames: { type: "stringArray"; } &amp; { defaultValue: unknown; }; connectionId: { type: "string"; } &amp; { defaultValue: string; }; type: { type: "string"; } &amp; { defaultValue: string; }; }, ConfigurationSchemaOptions&lt;undefined, "connectionId", true, ConfigurationSchemaRequirement&lt;Partial&lt;Record&lt;string, string[]&gt;&gt;, string&gt;, any&gt;&gt;&gt;)[]</code></pre></dialog></span> | list of config connections and session connections |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-addsessionconnectionconf">**addSessionConnectionConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(connectionConf: AnyConfiguration) =&gt; PluggableConfigNode &amp; ISt…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(connectionConf: AnyConfiguration) =&gt; PluggableConfigNode &amp; IStateTreeNode&lt;PluggableConfigSchemaType&gt;</code></pre></dialog></span> | Add a connection config to *this session*: it lands in `sessionConnections`, travels with the session when it is saved or shared, and never reaches the config.json the server hands every visitor. Idempotent on `connectionId`.<br><br>This is the one to call when the connection belongs to the session being built — a `&hubURL=` link, a session spec's `sessionConnections` — no matter who is looking. `addConnectionConf` below is the one whose destination depends on that. |
| <span id="action-addconnectionconf">**addConnectionConf**</span><br><code>(connectionConf: AnyConfiguration) =&gt; any</code> | Add a connection config wherever *this user's* edits belong: an admin's into the shared config (`jbrowse.connections`, which the admin server writes back into config.json for every visitor), everyone else's into the session. Two destinations behind one name, so call it only where that really is the intent — the "Open connection..." dialog, where an admin adding a hub means to add it for the whole site. Anything that means one destination should say which: `addSessionConnectionConf` above for the session, `jbrowse.addConnectionConf` for the config. |
| <span id="action-deleteconnection">**deleteConnection**</span><br><code>(configuration: AnyConfigurationModel) =&gt; any</code> |  |

<span data-pagefind-ignore>From [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin): <span id="action-makeconnection">[`makeConnection`](../connectionmanagementsessionmixin#action-makeconnection)</span>, <span id="action-breakconnection">[`breakConnection`](../connectionmanagementsessionmixin#action-breakconnection)</span>, <span id="action-teardownconnection">[`teardownConnection`](../connectionmanagementsessionmixin#action-teardownconnection)</span>, <span id="action-clearconnections">[`clearConnections`](../connectionmanagementsessionmixin#action-clearconnections)</span>, <span id="action-captureconnectiontrack">[`captureConnectionTrack`](../connectionmanagementsessionmixin#action-captureconnectiontrack)</span>, <span id="action-updateconnectiontrackconfig">[`updateConnectionTrackConfig`](../connectionmanagementsessionmixin#action-updateconnectiontrackconfig)</span>, <span id="action-setconnectiontrackconfig">[`setConnectionTrackConfig`](../connectionmanagementsessionmixin#action-setconnectiontrackconfig)</span>, <span id="action-pruneconnectiontrackconfig">[`pruneConnectionTrackConfig`](../connectionmanagementsessionmixin#action-pruneconnectiontrackconfig)</span>, <span id="action-hydrateconnection">[`hydrateConnection`](../connectionmanagementsessionmixin#action-hydrateconnection)</span></span>
