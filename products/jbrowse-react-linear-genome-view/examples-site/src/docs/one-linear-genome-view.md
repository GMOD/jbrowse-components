The smallest end-to-end example: pass an `assembly`, a list of `tracks`, an
`init` for the starting location, and an `onChange` handler straight to
`<LinearGenomeView>` as props — no `createViewState` call needed.

`onChange` fires with a JSON patch every time the view state mutates (pan, zoom,
track toggles), which is the hook you'd use to persist the session or sync it to
a URL.

```tsx
<LinearGenomeView
  assembly={assembly}
  tracks={tracks}
  init={{ loc: 'ctgA:1105..1221' }}
  onChange={patch => {
    // called on every state mutation
  }}
/>
```

`init.loc` only takes a locstring; to reach a `{refName, start, end}` object
instead, call `navToLocations` through a `ref` — see
[external navigation](../navigate-to-location/#external-navigate). That same
`ref` is how you drive the view imperatively (e.g. from an outside button).
For the lower-level, fully imperative form (`createViewState` +
`<JBrowseLinearGenomeView>`), see the
[embedded components guide](https://jbrowse.org/jb2/docs/embedded_components/).
