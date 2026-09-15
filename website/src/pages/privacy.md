---
layout: '../layouts/MarkdownLayout.astro'
title: Privacy policy
description: What usage data JBrowse collects and how to turn it off.
---

# Privacy policy

When jbrowse-web or jbrowse-desktop loads, it sends an anonymous usage report to
Google Analytics and to a JBrowse analytics endpoint. The report holds the
JBrowse version, load time, screen size, the renderer in use, counts of tracks,
assemblies and open views, and track type and plugin names.

JBrowse never sends file URLs, track names or your data. The browser reads your
data files directly, and they never pass through a JBrowse server. Embedded
JBrowse components collect nothing.

We use this data only to understand how people use JBrowse, and we do not sell
or share it. Google handles its copy under the
[Google privacy policy](https://policies.google.com/privacy).

To opt out, set `disableAnalytics: true` in your config
([details](/docs/config_guides/disable_analytics)), or block
`google-analytics.com` and `analytics.jbrowse.org`.

Questions: [contact us](/contact/).
