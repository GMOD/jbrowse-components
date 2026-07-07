A `ref` on `<LinearGenomeView>` gives you the live `LinearGenomeViewModel` — its
`.session.view` can be read, mutated, and have its actions called from
components outside the view tree, which is how you wire up "jump to this gene"
buttons, search-result lists, or programmatic tours.

[`navToLocString`](https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-navtolocstring)
takes a JBrowse-style locstring like `ctgA:1-5,000` or `chr1:1m-2m`. It's async,
re-sets the displayed regions if needed, and rejects on invalid input so you can
surface errors in a banner. Easiest to drive from a `<select>` or a static list
of bookmarks:

```js
ref.current?.session.view
  .navToLocString('ctgA:1,000..5,000')
  .catch(e => console.error(e))
```

For numeric coordinates you already have in hand, the parsed-object form
[`navToLocations`](../external-navigate-object/) skips the format/reparse
round-trip. The full set of navigation actions (`zoomTo`, `centerAt`,
`showAllRegions`, `moveTo`, …) is enumerated in the
[LinearGenomeView state model docs](https://jbrowse.org/jb2/docs/models/lineargenomeview/)
— anything marked `#action` there is callable on `ref.current.session.view`.
