---
id: avoiding_stale_config
title: Avoiding stale config
---

Some servers strongly cache the "config.json" file. If you want to avoid this,
you can edit the index.html of JBrowse to include the following

```

<!DOCTYPE html>
<html lang="en">
  <head>
    <script>
      window.__jbrowseCacheBuster = true
    </script>
    <meta charset="utf-8" />
```

This will request the config.json file with a random query string appended to
force the data to be fetched from the server instead of being loaded from the
local browser cache
