---
id: syntenyindels
title: SyntenyIndels
description: "The linear synteny and dotplot views' indels part: the insertions and deletions inside each alignment, read from its CIGAR. show: false draws each alignment as one block or one straight segment."
sidebar_label: View -> SyntenyIndels
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyIndelsConfigSchema.ts).

The linear synteny and dotplot views' `indels` part: the insertions and
deletions inside each alignment, read from its CIGAR. `show: false` draws
each alignment as one block or one straight segment. An opacity of 0 leaves
each indel a gap and any other opacity paints it in its operation's color;
unset, the synteny view leaves gaps and the dotplot draws each indel's line.

## Example usage

```js
{ type: 'LinearSyntenyView', indels: { show: false } }
```

```js
{ type: 'LinearSyntenyView', indels: { encoding: { opacity: 1 } } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the indels inside each alignment; off draws each alignment as one block |
| <span id="slot-encoding">**encoding**</span><br>[SyntenyIndelsEncoding sub-schema](#slot-encodingopacity) | The part's channels: `encoding.opacity`. |
| <span id="slot-encodingopacity">**encoding.opacity**</span><br>[SyntenyIndelsOpacity sub-schema](#slot-encodingopacityvalue) | `0` leaves each indel a gap and any other value paints it in its operation's color. Unset, the synteny view leaves gaps and the dotplot draws each indel's line. |
| <span id="slot-encodingopacityvalue">**encoding.opacity.value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | 0 leaves each indel a gap and any other value paints it in its operation's color; unset, the synteny view leaves gaps and the dotplot draws each indel's line |
