`createViewState` returns an object whose `.session.view` is the live
`LinearGenomeViewModel`. Components outside the view tree can read it, mutate
it, and call its actions — which is how you wire up "jump to this gene" buttons,
search-result lists, or programmatic tours.

`navToLocString` takes a JBrowse-style locstring like `ctgA:1-5,000` or
`chr1:1m-2m`. It's async, re-sets the displayed regions if needed, and rejects
on invalid input so you can surface errors in a banner. Easiest to drive from a
`<select>` or a static list of bookmarks:

```js
state.session.view
  .navToLocString('ctgA:1,000..5,000')
  .catch(e => console.error(e))
```

For numeric coordinates you already have in hand, the parsed-object form
[`navToLocations`](../external-navigate-object/) skips the format/reparse
round-trip. The full set of navigation actions (`zoomTo`, `centerAt`,
`showAllRegions`, `moveTo`, …) is enumerated in the
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
— anything marked `#action` there is callable on `state.session.view`.
