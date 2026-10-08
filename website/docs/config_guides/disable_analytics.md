---
title: Disabling analytics
description: Opt out of usage analytics
guide_category: Deployment
---

jbrowse-web and jbrowse-desktop report anonymous counts and type names on load
and when you leave the tab, never file URLs or data, and
`disableAnalytics: true` in the global `configuration` block turns both
endpoints off.

The report goes to Google Analytics and a JBrowse analytics endpoint on load. It
includes the JBrowse version, counts of tracks, assemblies and open views,
track, view and plugin type names, screen size, and which renderer was selected.
A second report to the JBrowse endpoint, sent when the tab is hidden or closed,
lists the types of view, track and side panel opened during the session and how
long it lasted; a random ID that lasts for one page load ties the two together.
No file URLs, track names or data are included: the browser reads your data
files directly and they never pass through a JBrowse server. Embedded components
collect nothing.

```json
{
  "configuration": {
    "disableAnalytics": true
  }
}
```

## JBrowse Desktop on Windows

The Windows installer shows the privacy policy and offers a "Send anonymous
usage reports" checkbox. Clearing it turns the report off for that install
whatever config or session you open afterwards, and a background update leaves
the choice as you left it. Run the installer again to change it.

## See also

- [](/docs/config_guides/intro)
- [JBrowseConfiguration config docs](/docs/config/jbrowseconfiguration)
