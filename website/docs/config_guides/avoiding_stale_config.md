---
title: Avoiding stale config
description:
  Cache-busting strategies for servers that aggressively cache config.json
guide_category: Other features
---

Some servers strongly cache the "config.json" file. If you want to avoid this,
you can add the following `<script>` to the `<head>` of the index.html of
JBrowse:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <script>
      window.__jbrowseCacheBuster = true
    </script>
    <meta charset="utf-8" />
    <!-- ...rest of head... -->
  </head>
</html>
```

This will request the config.json file with a random query string appended to
force the data to be fetched from the server instead of being loaded from the
local browser cache.
