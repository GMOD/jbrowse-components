---
id: disable_analytics
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
