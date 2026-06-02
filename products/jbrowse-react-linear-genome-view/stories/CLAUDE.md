# Storybook examples

Each story is a `*Render` function (the live render) plus a
`parameters.docs.source.code` string (what users see via "Show code").

**The `source.code` string must stay self-contained and copy-pasteable** —
inline the full config (or interpolate the self-contained `VOLVOX_SOURCE_CONFIG`
string), import only from the published package
(`@jbrowse/react-linear-genome-view2`), and do not reference internal helpers
like `getVolvoxConfig`. Users copy this verbatim into their own app.

Render functions may use `examples/util.tsx` (`getVolvoxConfig`, etc.) because
they load the local `test_data/volvox/config.json` with its many specific
trackIds — inlining there would replicate the whole config. That helper is
render-only and never appears in `source.code`.
