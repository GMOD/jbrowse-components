---
title: Config slot types
description:
  What each config slot type (fileLocation, frozen, stringEnum, color, ...)
  accepts as a value
guide_category: Core configuration
---

Every field on a [config schema page](/docs/config_guide) lists a **Type**. This
page explains what each type accepts, so a `Type: fileLocation` or
`Type: frozen` on a slot tells you what to actually write.

## string

Plain text, e.g. a track `name` or an `assemblyName`.

## stringArray

A list of strings, e.g. a track's `assemblyNames` or `category`.

## number

A numeric value (integer or decimal), e.g. a pixel height or a score threshold.

## maybeNumber

A number or unset, where unset is a distinct state that defers to a higher-tier
default (see `maybeBoolean`).

## integer

A whole number.

## boolean

`true` or `false`.

## maybeBoolean

`true`, `false`, or unset. Leaving it unset is a distinct third state: the slot
defers to a higher-tier default (the display-type or session default) instead of
pinning a value. Setting `true`/`false` pins the track either way. Used where
"follow the app default" must be distinguishable from an explicit off.

## fileLocation

Where a data file lives. The shorthand is a plain URL string:

```json
{ "uri": "https://example.com/data.bam" }
```

Most adapters accept a bare `uri` at the top level (see an adapter page's
_Example usage_) and expand it to the full object form for you. The full form
names the location kind explicitly:

```json
{ "uri": "https://example.com/data.bam", "locationType": "UriLocation" }
```

Other kinds are `LocalPathLocation` (`{ localPath, locationType }`, desktop
only) and `BlobLocation` (a file opened from the browser's file picker).

## stringEnum

One value from a fixed set. The allowed values are listed next to the slot, e.g.
`stringEnum (linear, log)`.

## color

A CSS color: a hex string (`#f00`), an `rgb()`/`rgba()` value, or a named color.
Many color slots also accept a [`jexl:` callback](/docs/config_guides/jexl) for
[per-feature coloring](/docs/config_guides/customizing_feature_colors).

## frozen

An arbitrary JSON value (object or array) stored as-is, for structured settings
that are not broken out into individual slots, for example a `colorBy` of
`{ "type": "methylation" }` or a `groupBy` of `{ "type": "strand" }`. The shape
a given `frozen` slot expects is described in that slot's own text.

## text

A multi-line string, e.g. an HTML template for a feature-details panel.

## See also

- [Using jexl callbacks](/docs/config_guides/jexl), for the `color` and other
  slots that accept `jexl:` expressions
- [Configuring tracks](/docs/config_guides/tracks), where `fileLocation` and
  other slots appear in a real track config
