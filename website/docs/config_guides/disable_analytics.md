---
id: disable_analytics
title: Disabling analytics
---

Currently, jbrowse-web and jbrowse-desktop use Google Analytics for collecting
usage data.

You can disable this behavior by adding a field in your config.json. For
example:

```json
{
  "configuration": {
    "disableAnalytics": true
  }
}
```

Note: The embedded components do not collect any analytics
