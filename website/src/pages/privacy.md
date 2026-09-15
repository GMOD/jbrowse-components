---
layout: '../layouts/MarkdownLayout.astro'
title: Privacy policy
description:
  What usage data JBrowse and this website collect, and how to turn it off.
---

# Privacy policy

When jbrowse-web or jbrowse-desktop loads, it sends an anonymous usage report to
Google Analytics and to a JBrowse analytics endpoint. The report holds the
JBrowse version, load time, screen size, the renderer in use, counts of tracks,
assemblies and open views, and track type and plugin names.

JBrowse never sends file URLs, track names or your data. The browser reads your
data files directly, and they never pass through a JBrowse server. Embedded
JBrowse components collect nothing.

This website (jbrowse.org/jb2) uses Google Analytics to count page visits, but
only after you click OK on its banner. Google Analytics sets cookies and records
the pages you view, your approximate location, browser and device type, and the
site that referred you. Clearing this site's data brings the banner back.

We use this data only to understand how people use JBrowse, and we do not sell
or share it. Google handles its copy under the
[Google privacy policy](https://policies.google.com/privacy).

To opt out in the apps, set `disableAnalytics: true` in your config
([details](/docs/config_guides/disable_analytics)). Anywhere, you can block
`google-analytics.com`, `googletagmanager.com` and `analytics.jbrowse.org`, or
install the
[Google Analytics opt-out add-on](https://tools.google.com/dlpage/gaoptout).

Questions: [contact us](/contact/).
