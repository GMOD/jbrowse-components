---
title: Disabling analytics
description: Opt out of usage analytics
guide_category: Other features
---

jbrowse-web and jbrowse-desktop collect anonymous usage data, sent to Google
Analytics and a JBrowse analytics endpoint. Setting `disableAnalytics: true`
turns off both:

```json
{
  "configuration": {
    "disableAnalytics": true
  }
}
```

:::info

Embedded components do not collect any analytics.

:::

`disableAnalytics` is one of the global `configuration` slots — see the
[intro to the config.json format](/docs/config_guides/intro) for where it sits,
and the [JBrowseConfiguration config docs](/docs/config/jbrowseconfiguration)
for the other global slots.
