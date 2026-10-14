---
name: a-mark-colored-by-source-takes-the-subtrack-colors
description: On the mark display over a multi-file track, `color: { field: 'source' }` paints from the categorical default palette. Each subadapter declares its own `color`, which the row label bars and the wiggle display paint, so an overlay spells the colors again as `domain` and `range` (the methylation tutorial's smoothing track does). The mark display's docs keep the row color on the label bar, so making the subtrack colors the default is a call against a written rule.
---

# A mark colored by source takes the subtrack colors

A `MultiWiggleAdapter` subadapter's `color` reaches the wiggle display's lines
and bars, and the mark display's row label bars, through the row color table
(`rowColorScales`). A mark whose `encoding.color` is `{ field: 'source' }`
resolves each source through `colorByKeys` and the categorical default palette,
so HP1 declared red and HP2 declared blue draw orange and red.

## What the workaround costs

The methylation tutorial's smoothing track spells
`"domain": ["HP1", "HP2"], "range": ["#d62728", "#1f77b4"]` on the line's color,
repeating the two subadapter colors three lines above. A reader who renames a
subtrack or changes its color has to change both.

## The rule it meets

`website/docs/config_guides/mark_display.md`, Rows: "The display's `rowColor`
paints the bar beside each row's label and leaves the marks their own color."
Taking the subtrack colors as the categorical default for the rows' own field
would make a declared or reader-set row color paint the marks on that field.

## The call

Whether a categorical color over the field `rows` splits on takes each value's
row color as its default `range`, with a written `range` still winning. A
narrower version takes the adapter's declared colors as that default and keeps a
reader's `rowColor` on the label bar.
