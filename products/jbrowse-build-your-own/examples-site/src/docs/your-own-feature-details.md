Click a gene above. The panel on the right is a plain `<dl>` in this file, and
the only thing connecting it to JBrowse is one field:

```ts
const { selection } = session
if (isFeature(selection)) {
  // your panel
}
```

There is no `onClick` anywhere in the example. The display already owns that
half — hit-testing the canvas, re-fetching the full feature by id (the painted
canvas only ever held slim render arrays), descending into whichever subfeature
was under the cursor — and finishes by writing to `session.selection`.

That is the **session-wide** selection, not a feature-track one: a circular view
puts a chord there, an arc display a paired feature. So it is typed `unknown`
and narrowing it is your job. `isFeature` from
`@jbrowse/core/util/simpleFeature` is the same guard JBrowse uses internally,
which makes this a check rather than a cast. `feature.toJSON()` is then a plain
object of that track's own parsed attributes, straight from the file — a GFF3
gene and a VCF variant do not have the same keys.

Because it is one session-level field, anything else you mount reads the same
selection with no wiring, and `session.clearSelection()` resets them all.

The same click path also queues JBrowse's `BaseFeatureWidget` into
`session.widgets`. Nothing here renders the drawer that would show it, and a
widget's React component is lazy, so it never loads; `session.hideWidget`
removes it if you would rather it were not there.
