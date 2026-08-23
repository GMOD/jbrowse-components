---
title: Opening track hubs by URL
description:
  Hand someone a link that loads one or more UCSC track hubs with the &hubURL=
  parameter
guide_category: General usage
---

**TL;DR:** The `&hubURL=` query parameter opens a
[UCSC track hub](/docs/user_guides/connections#ucsc-track-hub-url-format)
straight from a link, with no config file to set up first. Whoever opens the
link lands in JBrowse with the hub's assemblies and tracks already available.

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

## Opening the hub at a specific location

By default a hub opens wherever it says to (`defaultPos` in its `genomes`
stanza). Add [`&loc=`](/docs/urlparams#loc) and
[`&assembly=`](/docs/urlparams#assembly) to land somewhere else:

```
?config=none&hubURL=https://example.com/hub.txt&assembly=GCF_019202715.1&loc=chr1:1-100000
```

`&assembly=` is required here, and it is the hub's genome ID — the same name the
hub's `genomes.txt` (or its `genome` line, for a one-file hub) uses. `&loc=` on
its own has no assembly to resolve against, so JBrowse loads the hub at its own
default location and says why. `&tracks=` works the same way, naming track IDs
the hub defines.

## Loading several hubs

Pass a comma-separated list to open more than one hub at once:

```
?config=none&hubURL=https://example.com/hubA.txt,https://example.com/hubB.txt
```

Each hub becomes its own category in the track selector.

## How a loaded hub behaves

Each hub URL becomes a UCSC track hub
[connection](/docs/user_guides/connections) in the session, and from there it
behaves exactly like a connection you added by hand: lazily loaded, its own
category in the track selector, and only the tracks you open stored in the
session.

Hub tracks match to assemblies by genome ID, and the assemblies available are
whatever the hub carries plus whatever a combined `?config=` defines, so a hub
opened with `config=none` shows only the tracks its own assemblies cover.

## See also

- [](/docs/user_guides/connections) - adding the same hubs through the UI, the
  CLI, or a config
- [URL parameter API](/docs/urlparams#huburl) - the full list of launch
  parameters, including `&hubURL=`
- [Live demo: UCSC GenArk hub import](/gallery/#hubs)
