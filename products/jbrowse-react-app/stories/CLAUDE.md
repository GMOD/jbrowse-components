# Storybook examples

Each story is a `*Render` function (the live render) plus a
`parameters.docs.source.code` string (what users see via "Show code").

**The `source.code` string must stay self-contained and copy-pasteable** —
inline the full config, import only from the published package
(`@jbrowse/react-app2`), and do not reference shared helpers/consts. Users copy
this verbatim into their own app.

Render functions may use local helpers (e.g. `util.ts`) since they aren't
copied; but prefer inlining config there too for consistency unless it forces
real duplication.
