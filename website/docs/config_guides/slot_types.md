---
title: Config slot types
description:
  What each config slot type (fileLocation, frozen, stringEnum, color, ...)
  accepts as a value
guide_category: Core configuration
---

Every field on a [config schema page](/docs/config_guide) lists a **Type**. The
sections below say what each one accepts, so a `Type: fileLocation` or
`Type: frozen` on a slot tells you what to actually write. The `maybe*` types
are the ordinary ones plus an "unset" state, described
[in one section below](#the-maybe-types).

## string

Plain text, e.g. a track `name` or an `assemblyName`.

## featureField

A field the display reads off each feature: a name (`gene_biotype`), a dotted
path into a structured field (`INFO.SVTYPE`, a read's `tags.HP`), or a
[`jexl:` expression](/docs/config_guides/jexl) over `feature` that derives one
(`"jexl:feature.end - feature.start"`). The display evaluates the expression
once per feature, the way it reads a named field. The empty string names no
field, and each slot's own text says what it then does: a colour or facet
`field` left empty is off, a label left empty draws nothing, and `rows.field`
falls back to the display's default.

## stringArray

A list of strings, e.g. a track's `assemblyNames` or `category`.

## expressionArray

A list of [`jexl:` expressions](/docs/config_guides/jexl), each written with its
prefix, e.g. a display's `filter`: `["jexl:get(feature, 'score') > 10"]`. An
entry without the prefix fails the load and names the slot.

## stringArrayMap

An object whose every value is a list of strings, e.g.
`{ "groupA": ["sample1", "sample2"] }`.

## numberMap

An object whose every value is a number, e.g. `{ "chr1": 0.5 }`.

## stringMap

An object whose every value is a string, e.g. a row arrangement's `labels`,
which name a row by its key: `{ "HG002": "Child" }`.

## number

A numeric value (integer or decimal), e.g. a pixel height or a score threshold.

## integer

A whole number.

## boolean

`true` or `false`.

## fileLocation

Where a data file lives. The shorthand is a plain URL string:

```json
{ "uri": "https://example.com/data.bam" }
```

Most adapters accept a bare `uri` at the top level (see an adapter page's
_Example usage_) and expand it to the full form, which names the location kind:

```json
{ "uri": "https://example.com/data.bam", "locationType": "UriLocation" }
```

Other kinds are `LocalPathLocation` (`{ localPath, locationType }`, desktop
only) and `BlobLocation` (a file opened from the browser's file picker).

## stringEnum

One value from a fixed set, listed next to the slot, e.g.
`stringEnum (linear, log)`.

## stringEnumArray

A list whose every entry is one value from a fixed set, listed next to the slot,
e.g. `stringEnumArray (disc, triangle, diamond)`. An entry outside the set fails
the load and names the slot.

## color

A CSS color: a hex string (`#f00`), an `rgb()`/`rgba()` or `hsl()` value, a
named color, or a BED color triple (`255,0,0`). The empty string `""` means no
color, as in an `outlineColor` that draws no outline. Many color slots also
accept a [`jexl:` callback](/docs/config_guides/jexl) for
[per-feature coloring](/docs/config_guides/customizing_feature_colors).

## colorArray

A list of CSS colors, e.g. a colour scale's `range`. An entry that is not a
color, the empty string included, fails the load and names the slot.

## frozen

An arbitrary JSON value (object or array) stored as-is, for structured settings
such as a `sortedBy` of `{ "type": "basePair", "pos": 100 }`. The shape a given
`frozen` slot expects is described in that slot's own text.

## text

A multi-line string, e.g. an HTML template for a feature-details panel.

## The `maybe*` types {#the-maybe-types}

`maybeNumber`, `maybeBoolean`, `maybeString`, `maybeColor`, `maybeStringEnum`,
`maybeFrozen` and `maybeFileLocation` each accept everything the type without
the prefix accepts, plus one more state: **unset**.

A slot left unset holds no value of its own, which lets the display decide what
to do from the data in front of it — a state distinct from any value the slot
could hold, including one that looks like the display's usual choice. A
`maybeString` left unset is therefore not the empty string: a colour key's
`title` keeps the display's own heading while unset, and `""` is a key with no
heading.

## See also

- [](/docs/config_guides/jexl)
- [Configuring tracks](/docs/config_guides/tracks)
