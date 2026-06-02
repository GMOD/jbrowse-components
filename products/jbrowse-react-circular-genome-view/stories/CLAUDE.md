# Storybook examples

Each story is a `*Render` function (the live render) plus a
`parameters.docs.source.code` string (what users see via "Show code").

**The `source.code` string must stay self-contained and copy-pasteable** —
inline the full config, import only from the published package
(`@jbrowse/react-circular-genome-view2`), and do not reference shared
helpers/consts. Users copy this verbatim into their own app.

Render functions here also inline their config (no shared assembly/track
consts) to match, since the configs are small.
