Every page before this one puts pixels on screen. This one takes data back out.

Click a gene below. The panel on the right is a plain `<dl>` in this file, and
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
was actually under the cursor — and it finishes by writing the result to
`session.selection`. Reading that field is the whole integration.

## Why `unknown`, and why `isFeature`

`session.selection` is the session-wide selection, not a feature-track one: a
circular view puts a chord there, an arc display puts a paired feature. So it is
typed `unknown` and narrowing it is your job. `isFeature` from
`@jbrowse/core/util/simpleFeature` is the same guard JBrowse uses internally,
which is what makes this a check rather than a cast.

`feature.toJSON()` is then a plain object of that track's own parsed attributes.
What is in it comes from the file, so a GFF3 gene and a VCF variant do not have
the same keys — which is exactly why a panel you wrote beats a generic one.

## What JBrowse also does, and why it is free

The same click path queues JBrowse's own `BaseFeatureWidget` into
`session.widgets`. Nothing in these examples renders the drawer that would show
it, so it stays inert — and a widget's React component is lazy, so an unrendered
widget never loads and Material UI never enters the module graph on account of
it. You can ignore it. If you would rather it were not there at all,
`session.hideWidget` after reading the selection is enough.

## Selection is shared, which is the point

Because it is one session-level field, anything else you mount reads the same
selection with no wiring between them: a second panel, a sequence viewer, your
app's own URL state. And `session.clearSelection()` — what the Clear button
calls — resets all of them at once.
