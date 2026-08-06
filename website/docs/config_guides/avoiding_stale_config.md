---
title: Avoiding stale config
description:
  Cache-busting strategies for servers that aggressively cache config.json
guide_category: Deployment
---

Some servers aggressively cache `config.json`. To force a fresh fetch, add this
`<script>` to the `<head>` of JBrowse's index.html:

```html
<script>
  window.__jbrowseCacheBuster = true
</script>
```

This appends a random query string to the config.json request, bypassing the
browser cache. It is a single line, so a build script can inject it rather than
anyone hand-editing `index.html`.

## Serving the config from elsewhere

The same `<head>` script can also move the config JBrowse loads by default, for
a deployment whose config does not sit next to index.html:

```html
<script>
  window.__jbrowseConfigPath = '/configs/production.json'
</script>
```

This only changes the default. A [`?config=`](/docs/urlparams#config) in the URL
still takes precedence, so per-link overrides keep working.

## See also

- [](/docs/config_guides/deploying)
- [](/docs/config_guides/intro)
