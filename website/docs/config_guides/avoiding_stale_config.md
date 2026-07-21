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

Because `config.json` is fetched before it can configure anything, this snippet
is the one piece of deploy config that must live in `index.html` rather than in
`config.json`. It is a single line, so it is easy to inject from a build script
instead of hand-editing. See
[Deploying JBrowse Web](/docs/config_guides/deploying).

## See also

- [Deploying JBrowse Web](/docs/config_guides/deploying)
- [config.json format](/docs/config_guides/intro)
