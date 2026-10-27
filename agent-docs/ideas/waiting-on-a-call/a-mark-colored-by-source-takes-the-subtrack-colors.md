---
name: a-mark-colored-by-source-takes-the-subtrack-colors
description: On the mark display over a multi-file track, `color: { field: 'source' }` paints from the categorical default palette. Each subadapter declares its own `color`, which the row label bars and the wiggle display paint, so an overlay spells the colors again as `domain` and `range` (the methylation tutorial's smoothing track does). An unset mark color already paints the subtrack colors, and the wiggle display's `source` color reads them as its scale (ADR-251); the call is whether a written one does too, and what a written `range` then means.
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

The rule is out of date: since 85c919d1b8 a mark naming no color, under a
display naming none, paints each row in its row color
(`LinearMarkDisplay/model.ts`, `rowColorPaint`). So the unset color already
paints by subtrack in the subtrack colors, and a written `{ field: 'source' }`
paints the same variable through the palette: one variable, two scales.

## The wiggle display's answer

ADR-251 gives the wiggle display `encoding.color: { field: 'source' }`, which
reads its colors from the rows (`rowColor`, then the file's `color`, then the
palette over a shared plot) and paints nothing from its own `scale`.

## The call

Whether a categorical color over the field `rows` splits on takes each value's
row color as its scale, as the wiggle display's does. A written `range` either
still wins, which keeps the methylation tutorial's track as it draws, or moves
into `rowColor`. The key changes with it: today it lists the palette colors
`colorByKeys` dealt.
