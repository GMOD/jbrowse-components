---
id: formatabout
title: FormatAbout
sidebar_label: Root -> FormatAbout
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/formatAboutConfigSchema.ts).

## Example usage

On a track. The callback's variable is `config`, not `feature`, since the
dialog shows the track's own configuration rather than a feature:

```js
{
  type: 'FeatureTrack',
  trackId: 'genes',
  name: 'Genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff.gz',
  },
  formatAbout: {
    hideUris: true,
    config: "jexl:{Source:'GENCODE v44', adapter:undefined}",
  },
}
```

_See the **Config slots** section below for all available configuration fields._

jexl callbacks that add, rewrite or hide fields in a track's About dialog.
The same schema hangs off every track and off the session as
`configuration.formatAbout`, which applies to every track at once. Where both
are set the track's object is spread over the session's, so a track can
override individual keys the global callback added.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-formataboutconfig">**formatAbout.config**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | callback returning an object of fields to merge over the config shown<br>_callback args:_ `config` |
| <span id="slot-formatabouthideuris">**formatAbout.hideUris**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | leave file locations out of the About dialog, for a deployment that would rather not show users where the data sits. Hides URIs and local paths alike, drops the "Copy config" button, and suppresses the File info panel — a BAM's `@SQ UR:` and `@PG CL:` lines are locations too. "Show ref names" stays, since it exposes none. The two tiers are OR'd, so a session-wide `true` cannot be turned back on by a track. It hides the locations from the dialog only, not from `config.json` |
