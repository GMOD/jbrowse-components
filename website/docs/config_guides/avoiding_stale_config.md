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

The flag also adds a random query string to every runtime plugin loaded without
an integrity hash, so each visit downloads those plugins again. Where the server
can set headers, `Cache-Control: no-cache` on `config.json` keeps it fresh
without that cost
([cache headers](/docs/config_guides/deploying#let-browsers-keep-the-scripts)).

## Loading config.json from another path

A `<head>` script like the one above moves the config JBrowse loads by default,
for a deployment whose config does not sit next to index.html. A
[`?config=`](/docs/urlparams#config) in the URL still wins over it:

```html
<script>
  window.__jbrowseConfigPath = '/configs/production.json'
</script>
```

## See also

- [](/docs/config_guides/deploying)
- [](/docs/config_guides/intro)
