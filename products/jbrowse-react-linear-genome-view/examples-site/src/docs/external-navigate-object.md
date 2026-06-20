`navToLocations` takes an array of `{ refName, start, end, assemblyName? }`
objects. Use it instead of [`navToLocString`](../external-navigate-locstring/)
when you already have numeric coordinates — e.g. when bridging from a backend
search service — to skip the string formatting and parsing round-trip. Pass
multiple regions to land in a multi-region view:

```js
state.session.view
  .navToLocations([{ refName: 'ctgA', start: 1050, end: 9000 }])
  .catch(e => console.error(e))
```

### `navTo` vs `navToLocations`

There's also a lower-level `navTo(query)` action. The difference: `navTo` only
navigates if the target lies **inside the currently displayed regions** — it
won't re-set them. `navToLocations` (and `navToLocString`) will re-set displayed
regions as needed, so they're almost always what you want for external
navigation.

All three actions are part of the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/),
which documents the full navigation API.
