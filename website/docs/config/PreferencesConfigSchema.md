---
id: preferencesconfigschema
title: PreferencesConfigSchema
sidebar_label: Root -> PreferencesConfigSchema
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/PreferencesConfig.ts).

admin/embedder defaults for user-facing preferences, found on the root config
as `configuration.preferences`. Individual users override these at runtime
(persisted to localStorage) via the session `getPreference` reader; a runtime
override map layered over config defaults, at app scope.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-configurationpreferencesanimationmode">**configuration.preferences.animationMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (system, enabled, disabled) = <code>'enabled'</code> | controls feature-layout animations: 'enabled' always animates (the default), 'system' respects the OS prefers-reduced-motion setting, 'disabled' never animates |
| <span id="slot-configurationpreferencesscrollzoom">**configuration.preferences.scrollZoom**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | when true, scrolling the mouse wheel over a track zooms in and out without holding Ctrl. Applies globally to all wheel-zoom views. |
| <span id="slot-configurationpreferencesnumbergrouping">**configuration.preferences.numberGrouping**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | when true (the default), numbers are displayed with thousand separators — `chr1:1,234,567`. Turn it off to render them bare, which is what you want if you copy coordinates out of JBrowse into tools that won't accept the commas. Applies to every displayed number, and takes effect on reload. |
| <span id="slot-configurationpreferencesuseworkspaces">**configuration.preferences.useWorkspaces**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | when true, views open in the tabbed/tiled workspace layout rather than stacked vertically. Only the default: a session that names `useWorkspaces` itself (a shared snapshot, or a session spec carrying a `layout`) still wins, and a user's own toggle overrides it. |
| <span id="slot-configurationpreferencesdevelopermode">**configuration.preferences.developerMode**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | when true, the ordering-contract checks a display or plugin can break report themselves in the app rather than only in a development build. Off by default and deliberately not in the Preferences dialog: the messages are about code, and a reader who cannot change the code cannot act on one. Turn it on for a site that is running a plugin under development; a plugin author needs nothing here, since a plugin served from localhost arms the same channel on its own, as does `localStorage.jbrowseDeveloperMode`. Takes effect on reload. |
