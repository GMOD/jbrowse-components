---
id: disable_analytics
title: Disabling analytics
description: Opt out of Google Analytics usage tracking
guide_category: Other features
---

jbrowse-web and jbrowse-desktop use Google Analytics for usage data. To disable:

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
