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
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                                                         | Type      | Description                                  |
| ---------------------------------------------------------------------------- | --------- | -------------------------------------------- |
| [configuration.formatAbout.config](#slot-configurationformataboutconfig)     | `frozen`  | formats configuration object in about dialog |
| [configuration.formatAbout.hideUris](#slot-configurationformatabouthideuris) | `boolean` |                                              |

<details>
<summary>FormatAbout - Slots</summary>

#### slot: configuration.formatAbout.config

formats configuration object in about dialog

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

```js
{
  type: 'frozen',
  description: 'formats configuration object in about dialog',
  defaultValue: {},
  contextVariable: ['config'],
}
```

#### slot: configuration.formatAbout.hideUris

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

</details>
