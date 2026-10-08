---
title: Editing a track's plot as text
description:
  Advanced → Edit plot... in a track's menu shows the track's color, grouping,
  rows, axis scales and filters as text, the way a config file writes them, with
  worked examples and a check of what you type
guide_category: General usage
---

Every track whose display has color, grouping, rows, axis or filter settings has
**Advanced → Edit plot...** in its track menu. It opens those settings as text,
in the shape a config file writes them, so anything the menus and dialogs cannot
express (a ramp, several threshold cuts, a typed section order, a filter
expression) can be written directly. The Group by, Color by attribute and color
dialogs also open it from a button, filled in with the choice you have made
there but not yet applied.

## What the box shows

The text holds the current values of this display's settings. A setting at its
default is left out, as it would be in a config file. Show help lists the
settings, each with a line saying what it holds. Which settings appear depends
on the display:

| Display                              | Settings                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| Feature, single-sample variant       | `facet`, `color`, `filter`                                                          |
| Multi-row feature                    | `facet`, `rows`, `rowColor`, `color`                                                |
| Multi-sample variant                 | `unit`, `facet`, `rows`, `rowColor`, `color`, `filter`                              |
| Alignments, synteny in a genome view | `unit`, `facet`, `color`, `baseColor`, `arcColor`, `scales`, `filter`               |
| Quantitative                         | `mark`, `interpolate`, `rows`, `rowColor`, `color`, `scales`, `y`, `size`, `origin` |
| Multiple alignment (MAF)             | `rows`, `rowColor`, `color`, `y`                                                    |
| Hi-C, linkage disequilibrium (LD)    | `color`                                                                             |
| Multi-way synteny                    | `rows`, `color`, `ribbonColor`, `laneLayers`                                        |
| Mark plot, Manhattan                 | `marks`, `transform`, `facet`, `rows`, `rowColor`, `scales`, `origin`, `filter`     |

The circular view's chord display has a plot too, `color`, and no Edit plot row
in its track menu; code reads and writes it through the display's `plot`, as
[the live model guide](/docs/agents_live_model) describes.

The Config reference link opens the display's page in the
[config reference](/docs/config_guide), which spells out each setting's members.

## Examples

The buttons above the text are worked examples for that display. A button fills
the text with its example laid over the current settings, so you can read what
it changes before applying it. For a feature track:

```json
{ "facet": "strand", "color": { "field": "type" } }
```

stacks one section per strand and colors each feature by its type.

## Writing and applying

- A setting left out stays as it is.
- An object replaces the setting whole: a member you delete returns to its
  default.
- `null` resets a setting.
- A string is a setting's one-value form, such as a facet's field or a constant
  color.

The line under the text says which settings applying would set or reset, and
Apply is disabled while the text is something the track's config would refuse,
with the reason shown. A setting spelled another way but meaning the same thing
changes nothing. Apply writes the settings onto the track, so they are kept with
the session and **Reset track settings** returns them to the track's config.

## From an agent or a script

The same settings are a display's `plot`: read `display.plot`, edit a copy,
check it with `display.plotProblems(draft)`, and write it with
`display.applyPlot(draft)`. See
[Agents and the live model](/docs/agents_live_model).
