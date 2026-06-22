---
title: Avoiding stale config
description:
  Cache-busting strategies for servers that aggressively cache config.json
guide_category: Other features
---

Some servers aggressively cache `config.json`. To force a fresh fetch, add this
`<script>` to the `<head>` of JBrowse's index.html:

```html
<script>
  window.__jbrowseCacheBuster = true
</script>
```

This appends a random query string to the config.json request, bypassing the
browser cache.
