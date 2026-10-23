---
id: syntenyindels
title: SyntenyIndels
description: "The linear synteny and dotplot views' indels part: the insertions and deletions inside each alignment, read from its CIGAR. show: false draws each alignment as one block or one straight segment; an…"
sidebar_label: View -> SyntenyIndels
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyIndelsConfigSchema.ts).

The linear synteny and dotplot views' `indels` part: the insertions and
deletions inside each alignment, read from its CIGAR. `show: false` draws
each alignment as one block or one straight segment; an opacity of 0 leaves
each indel a gap.

## Example usage

```js
{ type: 'LinearSyntenyView', indels: { show: false } }
```

```js
{ type: 'LinearSyntenyView', indels: { encoding: { opacity: 0 } } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the indels inside each alignment; off draws each alignment as one block |
| <span id="slot-encoding">**encoding**</span><br>[SyntenyIndelsEncoding sub-schema](#slot-encodingopacity) | The part's channels: `encoding.opacity`. |
| <span id="slot-encodingopacity">**encoding.opacity**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'SyntenyIndelsOpacity', { value: { type: '…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'SyntenyIndelsOpacity',&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;value: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'maybeNumber',&#10;&#160;&#160;&#160;&#160;&#160;&#160;description:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;"0 leaves each indel a gap; unset, or any other value, paints it in its operation's color",&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;},&#10;&#160;&#160;{ shorthand: 'value', writes: 'whole', closed: true },&#10;)</code></pre></dialog></span> | `0` leaves each indel a gap; unset, or any other value, paints it in its operation's color. |
| <span id="slot-value">**value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | 0 leaves each indel a gap; unset, or any other value, paints it in its operation's color |
