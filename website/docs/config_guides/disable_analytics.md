---
title: Disabling analytics
description: Opt out of usage analytics
guide_category: Deployment
---

**TL;DR:** jbrowse-web and jbrowse-desktop report anonymous counts and type
names on load, never file URLs or data, and `disableAnalytics: true` in the
global `configuration` block turns both endpoints off.

The report goes to Google Analytics and a JBrowse analytics endpoint on load. It
carries the JBrowse version, counts of tracks, assemblies and open views, track
type names, plugin names, screen size, and which renderer was selected. No file
URLs, track names or data are included: the browser reads your data files
directly and they never pass through a JBrowse server. Embedded components
collect nothing.

```json
{
  "configuration": {
    "disableAnalytics": true
  }
}
```

## See also

- [](/docs/config_guides/intro)
- [JBrowseConfiguration config docs](/docs/config/jbrowseconfiguration)
