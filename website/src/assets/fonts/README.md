# Vendored fonts

`roboto-latin-variable.woff2` is the latin subset of Roboto v51, as Google Fonts
serves it: a variable font with a `wght` axis of 100–900, 363 glyphs, 42 kB.
Licensed Apache-2.0 — `LICENSE.txt` beside it.

## Why it is committed rather than downloaded

`astro.config.mjs` used `fontProviders.google()`, which fetches from
`fonts.gstatic.com` **at build time**. The rendered site was already
self-hosted, so this bought nothing at runtime and made a docs build depend on
Google being reachable. On 2026-08-10 it wasn't: `Build website` failed with
`CannotFetchFontFile` and a stack trace into rolldown, with nothing wrong in the
tree. Same objection `scripts/third-party-hosts.txt` makes about figure specs —
a build should not need a server we do not run.

One file covers every weight the site uses. The five static weights the config
used to request (400/500/600/700/900) all resolved to this one URL, because the
latin subset has been a variable font since Roboto v51.

## Updating it

Deliberately manual. Automating the fetch would put the network back in the
build, which is the thing this removed.

```sh
curl -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700;900&display=swap"
```

The user-agent matters: Google serves woff2 only to browsers it recognises, and
ttf to everything else. Take the URL from the `/* latin */` block — not
`latin-ext`, which is a different, larger subset — download it over this file,
and check the axis survived:

```sh
python3 -c "from fontTools.ttLib import TTFont; f=TTFont('roboto-latin-variable.woff2'); print([(a.axisTag,a.minValue,a.maxValue) for a in f['fvar'].axes])"
```

If a future Roboto drops the variable axis, the config needs one `variants`
entry per weight again, each with its own file, rather than the single `100 900`
entry.
