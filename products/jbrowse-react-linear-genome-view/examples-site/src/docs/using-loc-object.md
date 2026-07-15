If you don't need a full default session — just "land on this region" — pass a
top-level `location` to `createViewState`. It accepts either a locstring or a
`{ refName, start, end }` object. The object form is useful when you already
have structured coordinates and don't want to format and reparse a string:

```js
const state = createViewState({
  assembly,
  tracks,
  location: { refName: '10', start: 29838737, end: 29838819 },
})
```

For opening tracks declaratively alongside the location, prefer the
[`init`](../with-init/) field instead.
