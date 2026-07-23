---
title: Opening track hubs by URL
description: Hand someone a link that loads one or more UCSC track hubs with the &hubURL= parameter
guide_category: General usage
---

The `&hubURL=` query parameter opens a
[UCSC track hub](/docs/user_guides/connections#ucsc-track-hub-url-format)
straight from a link, with no config file to set up first. It is the one-click
way to share a hub: whoever opens the link lands in JBrowse with the hub's
assemblies and tracks already available.

The [UCSC GenArk hub import](/demos/#instances) on the demos page is exactly this
- a single URL that opens a hub.

## Basic usage

```
https://jbrowse.org/code/jb2/latest/?config=none&hubURL=https://example.com/hub.txt
```

- `hubURL=` points directly at the hub's `hub.txt` file (the same URL you would
  paste into the connection form).
- `config=none` skips loading a JBrowse config, because the hub supplies its own
  assemblies and tracks. See [`?config=`](/docs/urlparams#config).

JBrowse reads the hub's `shortLabel` and uses it as the session name.

## Combining with a config

Drop `config=none` and point [`?config=`](/docs/urlparams#config) at a real
config when the launch needs something the hub does not carry, such as plugins
or extra assemblies:

```
?config=myconfig.json&hubURL=https://example.com/hub.txt
```

The hub's tracks are added on top of whatever the config already defines.

## Loading several hubs

Pass a comma-separated list to open more than one hub at once:

```
?config=none&hubURL=https://example.com/hubA.txt,https://example.com/hubB.txt
```

Each hub becomes its own category in the track selector.

## How it behaves once loaded

Each hub URL becomes a UCSC track hub
[connection](/docs/user_guides/connections) in the session, so it behaves just
like a connection you added by hand:

- the hub is a category in the track selector, loaded lazily when you expand it,
  so even a hub with thousands of tracks stays out of the way until you want it;
- only the tracks you actually open are stored in the session, so saving or
  sharing that session stays lightweight.

A hub's tracks match to assemblies by genome ID. Tracks targeting an assembly
that is not present (from the hub itself, or from a `?config=` you combined it
with) will not appear.

## See also

- [Connections](/docs/user_guides/connections) - adding the same hubs through the
  UI, the CLI, or a config
- [URL parameter API](/docs/urlparams#huburl) - the full list of launch
  parameters, including `&hubURL=`
- [Live demo: UCSC GenArk hub import](/demos/#instances)
