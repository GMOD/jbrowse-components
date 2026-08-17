A view's SVG export is a tree of ordinary React components. `view.exportSvg()`
renders it with `renderToStaticMarkup` and hands the browser a download — but
serializing is the last step, not the point. Mount the same components yourself
and the figure lands in the page, no file involved.

What that buys is what the DOM gives. The gene names in the figure below are
`<text>`, so the browser's own Find locates them and a reader can select one;
the glyphs are `<path>` and `<rect>`, so a stylesheet of yours restyles the
figure and a vector editor opens it unchanged; and a screen reader reaches
labels a canvas never exposes.

What it costs is nodes. A redraw walks every visible feature and builds a few
thousand DOM elements, so this is a picture of where the reader arrived rather
than a second renderer to pan with — hence the canvas browser on top and a
redraw on the settle. `rasterizeLayers` is the reversal: each display's heavy
draw path paints to a canvas and embeds a PNG, which is the right answer for a
hundred-thousand-read pileup and the wrong one for everything this page is
about.

**Two one-call forms remain, and one is probably what you want** — neither
mounts anything, and both take the same options:

```ts
// straight to a file, from a button in your own UI
await view.exportSvg({ filename: 'figure.svg' })

// the same document as a markup string — to POST to a server or store beside a
// report
import { renderToSvg } from '@jbrowse/plugin-linear-genome-view'

const markup = await renderToSvg(view, { rasterizeLayers: false })
```

Reach for the components when the figure has to be _in_ the page: your app
annotating it in the view's own frame, print styling reaching inside it, a
reader interacting with the marks.

**A display type with no `renderSvg` is dropped rather than failing the
figure**, so one third-party display costs its own track a place and not the
whole export. `renderViewTracks` hands those tracks back for you to say so:
afterwards, a figure one track short looks exactly like a figure of a two-track
view.
