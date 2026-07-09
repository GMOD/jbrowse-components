A `ref` on `<LinearGenomeView>` gives you the live `LinearGenomeViewModel` — its
`.session.view` can be read, mutated, and have its actions called from
components outside the view tree, which is how you wire up "jump to this gene"
buttons, search-result lists, or programmatic tours. This example drives one
view two ways.

[`navToLocString`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-navtolocstring)
takes a JBrowse-style locstring like `ctgA:1-5,000` or `chr1:1m-2m`. It's async,
re-sets the displayed regions if needed, and rejects on invalid input so you can
surface errors in a banner:

```js
ref.current?.session.view
  .navToLocString('ctgA:1,000..5,000')
  .catch(e => console.error(e))
```

[`navToLocations`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-navtolocations)
takes an array of `{ refName, start, end, assemblyName? }` objects, plus an
optional second `assemblyName` default. Use it when you already have numeric
coordinates — e.g. bridging from a backend search service — to skip the string
formatting and parsing round-trip. Pass multiple regions to land in a
multi-region view:

```js
ref.current?.session.view
  .navToLocations([{ refName: 'ctgA', start: 1050, end: 9000 }], 'volvox')
  .catch(e => console.error(e))
```

There's also a lower-level
[`navTo(query)`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-navto)
that only navigates if the target lies **inside the currently displayed
regions** — it won't re-set them, so `navToLocations`/`navToLocString` are almost
always what you want for external navigation. The full set of navigation actions
(`zoomTo`, `centerAt`, `showAllRegions`, `moveTo`, …) is enumerated in the
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
— anything marked `#action` there is callable on `ref.current.session.view`.
