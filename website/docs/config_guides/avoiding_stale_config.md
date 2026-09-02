---
title: Avoiding stale config
description:
  Cache-busting strategies for servers that aggressively cache config.json
guide_category: Deployment
---

Some servers aggressively cache `config.json`. This `<script>` in the `<head>`
of JBrowse's index.html appends a random query string to the config.json
request, bypassing the browser cache:

```html
<script>
  window.__jbrowseCacheBuster = true
</script>
```

## Loading config.json from another path

The same `<head>` script moves the config JBrowse loads by default, for a
deployment whose config does not sit next to index.html. A
[`?config=`](/docs/urlparams#config) in the URL still wins over it:

```html
<script>
  window.__jbrowseConfigPath = '/configs/production.json'
</script>
```

## See also

- [](/docs/config_guides/deploying)
- [](/docs/config_guides/intro)
