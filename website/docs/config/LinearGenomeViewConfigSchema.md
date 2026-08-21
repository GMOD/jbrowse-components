---
id: lineargenomeviewconfigschema
title: LinearGenomeViewConfigSchema
sidebar_label: Root -> LinearGenomeViewConfigSchema
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/index.ts).

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-configurationlineargenomeviewplugintracklabels">**configuration.LinearGenomeViewPlugin.trackLabels**</span><br>[`string`](/docs/config_guides/slot_types#string) (offset, overlapping, hidden) = <code>'offset'</code> | where a track's name is drawn: `offset` gives it its own line above the data, `overlapping` floats it over the top of the data to save vertical space, `hidden` omits it. The view menu's "Show..." submenu sets the same thing per session, under its "Track labels" heading |
