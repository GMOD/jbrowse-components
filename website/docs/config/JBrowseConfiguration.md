---
id: jbrowseconfiguration
title: JBrowseConfiguration
sidebar_label: Root -> JBrowseConfiguration
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseConfig/RootConfiguration.ts).

this is the entry under the `configuration` key e.g.

```json
{
  assemblies,
  tracks,
  configuration: { these entries here  }
}
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-configurationrpc">**configuration.rpc**</span><br><code>RpcManager.configSchema</code> | configuration for the RPC system that runs data adapters in web workers, see RpcOptions |
| <span id="slot-configurationformatdetails">**configuration.formatDetails**</span><br><code>FormatDetailsConfigSchemaFactory()</code> | jexl callbacks that add, rewrite or hide fields in the feature-details panel of every track at once. Four slots, listed at [FormatDetails](/docs/config/formatdetails); a track can set the same ones on its own `formatDetails` and override individual keys. |
| <span id="slot-configurationformatabout">**configuration.formatAbout**</span><br><code>FormatAboutConfigSchemaFactory()</code> | jexl callbacks that add, rewrite or hide fields in the About dialog of every track at once. Two slots, listed at [FormatAbout](/docs/config/formatabout); a track can set the same ones on its own `formatAbout` and override individual keys. |
| <span id="slot-configurationshareurl">**configuration.shareURL**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'https://share.jbrowse.org/api/v1/'</code> | URL of the session-sharing backend used by the Share button, a JBrowse-hosted service by default<br>_advanced_ |
| <span id="slot-configurationdisableanalytics">**configuration.disableAnalytics**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | disables collection of anonymous usage analytics<br>_advanced_ |
| <span id="slot-configurationhierarchical">**configuration.hierarchical**</span><br><code>HierarchicalConfigSchemaFactory()</code> | configuration for the hierarchical track selector, controlling sorting and default categories, see HierarchicalConfigSchema |
| <span id="slot-configurationpreferences">**configuration.preferences**</span><br><code>PreferencesConfigSchemaFactory()</code> | user preferences such as scroll-to-zoom and animation behavior, see PreferencesConfigSchema |
| <span id="slot-configurationtheme">**configuration.theme**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | Material UI theme overrides applied to the JBrowse UI |
| <span id="slot-configurationextrathemes">**configuration.extraThemes**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | additional named themes the user can switch between<br>_advanced_ |
| <span id="slot-configurationlogopath">**configuration.logoPath**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '', locationType: 'UriLocation' }</code> | path to a custom logo image displayed in the app header<br>_advanced_ |
