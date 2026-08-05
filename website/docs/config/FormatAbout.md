---
id: formatabout
title: FormatAbout
sidebar_label: Root -> FormatAbout
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/FormatAbout.ts).

generally exists on the config.json or root config as configuration.formatAbout

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-configurationformataboutconfig">**configuration.formatAbout.config**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | formats configuration object in about dialog<br>_callback args:_ `config` |
| <span id="slot-configurationformatabouthideuris">**configuration.formatAbout.hideUris**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | leave file locations out of every About dialog in the session, for a deployment that would rather not show users where the data sits. A track can set the same slot on its own `formatAbout`. |
