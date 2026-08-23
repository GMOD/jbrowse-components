---
title: Config slot types
description:
  What each config slot type (fileLocation, frozen, stringEnum, color, ...)
  accepts as a value
guide_category: Core configuration
---

**TL;DR:** every field on a [config schema page](/docs/config_guide) lists a
**Type**. This page says what each one accepts, so a `Type: fileLocation` or
`Type: frozen` on a slot tells you what to actually write. The `maybe*` types
are the ordinary ones plus an "unset" state, described
[in one section below](#the-maybe-types).

## string

Plain text, e.g. a track `name` or an `assemblyName`.

## stringArray

A list of strings, e.g. a track's `assemblyNames` or `category`.

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
such as a `colorBy` of `{ "type": "methylation" }` or a `groupBy` of
`{ "type": "strand" }`. The shape a given `frozen` slot expects is described in
that slot's own text.

## text

A multi-line string, e.g. an HTML template for a feature-details panel.

## The `maybe*` types {#the-maybe-types}

`maybeNumber`, `maybeBoolean`, `maybeStringEnum`, and `maybeFrozen` each accept
everything the type without the prefix accepts, plus one more state: **unset**.

A slot left unset follows the display-type default (see
[defaults for all tracks](/docs/user_guides/display_defaults)) and keeps
following it as that default changes; writing a value, even the one the default
happens to hold, pins the track to that value. These types are used wherever
"follow the default" has to stay distinguishable from an identical-looking
explicit choice — a display's `heightMode` or `displayMode`, or an alignments
track's `colorBy`, where every scheme including `normal` is something a user
might deliberately pin.

## See also

- [](/docs/config_guides/jexl)
- [Configuring tracks](/docs/config_guides/tracks)
- [](/docs/user_guides/display_defaults)
