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
in the format of a config file, so you can write what the menus and dialogs
cannot express (a ramp, several threshold cuts, a typed section order, a filter
expression). The Group by, Color by attribute and color dialogs also open it
from a button, filled in with the choice you have made there but not yet
applied.

## Contents of the text box

<Figure src="/img/edit_plot/dialog.png" caption="Edit plot on a gene track with the help open: each setting linked to the config reference, the example buttons, and the plot as text." />

The text holds the current values of this display's settings, leaving out any at
its default, as a config file does. Which settings appear depends on the
display:

<!-- BEGIN GENERATED PLOT_SETTINGS -->

| Display                                              | Settings                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Alignments display (`LinearAlignmentsDisplay`)       | `unit`, `filter`, `facet`, `sort`, `encoding`, `legend`, `coverage`, `pileup`, `readConnections`, `junctions` |
| Chord synteny display (`ChordSyntenyDisplay`)        | `mark`                                                                                                        |
| Chord variant display (`ChordVariantDisplay`)        | `mark`, `encoding`                                                                                            |
| Feature display (`LinearBasicDisplay`)               | `filter`, `legend`, `encoding`, `mark`, `facet`, `labels`                                                     |
| Hi-C contact matrix display (`LinearHicDisplay`)     | `encoding`, `legend`, `filter`                                                                                |
| LD heatmap display (`LDTrackDisplay`)                | `connectors`, `encoding`, `legend`, `labels`                                                                  |
| MAF display (`LinearMafDisplay`)                     | `encoding`, `rows`, `legend`, `coverage`, `alignments`, `conservation`                                        |
| Manhattan plot display (`LinearManhattanDisplay`)    | `marks`, `transform`, `facet`, `rows`, `encoding`, `origin`, `legend`, `filter`                               |
| Marks (`LinearMarkDisplay`)                          | `marks`, `transform`, `facet`, `rows`, `encoding`, `origin`, `legend`, `filter`                               |
| Multi-row display (`LinearMultiRowFeatureDisplay`)   | `marks`, `transform`, `facet`, `rows`, `encoding`, `origin`, `legend`, `filter`                               |
| Multi-way synteny display (`MultiWaySyntenyDisplay`) | `encoding`, `rows`, `ribbons`, `legend`, `labels`, `laneLayers`                                               |
| Synteny alignments display (`LGVSyntenyDisplay`)     | `unit`, `filter`, `facet`, `sort`, `encoding`, `legend`, `coverage`, `pileup`, `readConnections`              |
| Variant display (`LinearVariantDisplay`)             | `connectors`, `filter`, `rows`, `encoding`, `legend`, `facet`, `records`, `genotypes`                         |
| Wiggle display (`LinearWiggleDisplay`)               | `mark`, `rows`, `encoding`, `origin`, `legend`                                                                |

<!-- END GENERATED PLOT_SETTINGS -->

Two of them split a track by a field: `facet` stacks labelled sections, one per
value, and `rows` draws one row per value, which a tree can order.

The circular view's chord displays have a plot too: `mark`, how deeply each
chord curves, and on the variant display `encoding.color`. Their Edit plot row
is under the view menu's Tracks entry.

## Examples

An example button fills the text with its example laid over the current
settings, so you can read what it changes before applying it. For a feature
track:

```json
{ "facet": "strand", "encoding": { "color": "type" } }
```

stacks one section per strand and colors each feature by its type.

## Writing and applying

- **Whole plot:** a setting or a member you delete from the text returns to its
  default.
- **Examples** merge into the plot as it stands and change only what they name,
  so an example writing a `filter` list keeps the filter's other tests in the
  text.
- **Strings:** a string is a setting's one-value form, such as a facet's field
  or a color's field.
- **Preview:** the line under the text lists which settings applying would set
  or reset. Apply is disabled, with the reason shown, while the text is
  something the track's config would refuse, and a setting spelled another way
  but meaning the same thing changes nothing.
- **Kept:** Apply writes the settings onto the track, so they are kept with the
  session, and **Reset track settings** returns them to the track's config.

## From an agent or a script

A display exposes the same settings as `plot`: read `display.plot`, edit a copy,
check it with `display.plotProblems(draft)`, and write it with
`track.applyDisplaySettings(draft)`. A script's draft patches the plot, where
this box states it whole: a setting the draft leaves out stays, and `null`
resets one. See [Agents and the live model](/docs/agents_live_model).
