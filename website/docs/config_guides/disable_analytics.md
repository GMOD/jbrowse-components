---
title: Disabling analytics
description: Opt out of usage analytics
guide_category: Deployment
---

**TL;DR:** jbrowse-web and jbrowse-desktop report anonymous counts and type
names on load, never file URLs or data, and `disableAnalytics: true` in the
global `configuration` block turns both endpoints off.

jbrowse-web and jbrowse-desktop collect anonymous usage data, sent to Google
Analytics and a JBrowse analytics endpoint.

The report is sent on load and carries the JBrowse version, counts of tracks,
assemblies and open views, track type names, plugin names, screen size, and
which renderer was selected. No file URLs, track names or data are included —
your data files are read by the browser directly and never pass through a
JBrowse server.

Setting `disableAnalytics: true` turns off both endpoints:

```json
{
  "configuration": {
    "disableAnalytics": true
  }
}
```

Embedded components do not collect any analytics.

`disableAnalytics` is one of the global `configuration` slots. See the
[intro to the config.json format](/docs/config_guides/intro) for where it sits,
and the [JBrowseConfiguration config docs](/docs/config/jbrowseconfiguration)
for the other global slots.

## See also

- [](/docs/config_guides/intro)
- [JBrowseConfiguration config docs](/docs/config/jbrowseconfiguration)
