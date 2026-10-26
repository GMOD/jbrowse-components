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
default is left out, as it would be in a config file. Show help links each
setting to its row in the config reference. Which settings appear depends on the
display:

<!-- BEGIN GENERATED PLOT_SETTINGS -->

| Display                                                               | Settings                                                                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Alignments display (`LinearAlignmentsDisplay`)                        | `unit`, `filter`, `facet`, `sort`, `encoding`, `legend`, `coverage`, `pileup`, `readConnections`, `sashimi` |
| Chord synteny display (`ChordSyntenyDisplay`)                         | `mark`                                                                                                      |
| Chord variant display (`ChordVariantDisplay`)                         | `mark`, `encoding`                                                                                          |
| Feature display (`LinearBasicDisplay`)                                | `filter`, `legend`, `encoding`, `mark`, `facet`, `labels`                                                   |
| Hi-C contact matrix display (`LinearHicDisplay`)                      | `encoding`, `legend`, `filter`                                                                              |
| LD heatmap display (`LDTrackDisplay`)                                 | `encoding`, `legend`, `labels`                                                                              |
| MAF display (`LinearMafDisplay`)                                      | `encoding`, `rows`, `rowColor`, `legend`, `coverage`, `alignments`, `conservation`                          |
| Manhattan plot display (`LinearManhattanDisplay`)                     | `marks`, `transform`, `facet`, `rows`, `rowColor`, `encoding`, `origin`, `legend`, `filter`                 |
| Marks (`LinearMarkDisplay`)                                           | `marks`, `transform`, `facet`, `rows`, `rowColor`, `encoding`, `origin`, `legend`, `filter`                 |
| Multi-row feature display (painting) (`LinearMultiRowFeatureDisplay`) | `marks`, `transform`, `facet`, `rows`, `rowColor`, `encoding`, `origin`, `legend`, `filter`                 |
| Multi-sample variant display (`LinearMultiSampleVariantDisplay`)      | `filter`, `rows`, `unit`, `encoding`, `legend`, `rowColor`, `facet`, `variants`                             |
| Multi-way synteny display (`MultiWaySyntenyDisplay`)                  | `encoding`, `rows`, `ribbons`, `legend`, `labels`, `laneLayers`                                             |
| Synteny alignments display (`LGVSyntenyDisplay`)                      | `unit`, `filter`, `facet`, `sort`, `encoding`, `legend`, `coverage`, `pileup`, `readConnections`            |
| Variant display (`LinearVariantDisplay`)                              | `filter`, `legend`, `encoding`, `mark`, `facet`, `labels`                                                   |
| Wiggle display (`LinearWiggleDisplay`)                                | `mark`, `rows`, `rowColor`, `encoding`, `origin`, `legend`, `extent`                                        |

<!-- END GENERATED PLOT_SETTINGS -->

Two of them split a track by a field: `facet` stacks labelled sections, one per
value, and `rows` draws one row per value, which a tree can order.

The circular view's chord displays have a plot too: `mark`, how deeply each
chord curves, and on the variant display `encoding.color`. Their Edit plot row
is under the view menu's Tracks entry, since a track on the circle has no label
to hang a menu off.

The Config reference link opens the display's page in the
[config reference](/docs/config_guide), which spells out each setting's members.

## Examples

The buttons above the text are worked examples for that display. A button fills
the text with its example laid over the current settings, so you can read what
it changes before applying it. For a feature track:

```json
{ "facet": "strand", "encoding": { "color": "type" } }
```

stacks one section per strand and colors each feature by its type.

## Writing and applying

- The text is the whole plot: a setting or a member you delete returns to its
  default.
- An example lands over the plot as it stands and changes only what it names, so
  an example writing a `filter` list keeps the filter's other tests in the text.
- A string is a setting's one-value form, such as a facet's field or a color's
  field.

The line under the text lists which settings applying would set or reset, and
Apply is disabled while the text is something the track's config would refuse,
with the reason shown. A setting spelled another way but meaning the same thing
changes nothing. Apply writes the settings onto the track, so they are kept with
the session and **Reset track settings** returns them to the track's config.

## From an agent or a script

A display exposes the same settings as `plot`: read `display.plot`, edit a copy,
check it with `display.plotProblems(draft)`, and write it with
`track.applyDisplaySettings(draft)`. A script's draft patches the plot, where
this box states it whole: a setting the draft leaves out stays, and `null`
resets one. See [Agents and the live model](/docs/agents_live_model).
