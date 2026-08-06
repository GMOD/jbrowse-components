`createApp(element, options)` mounts the same engine as
[`<JBrowse>`](../basic-example/) with no React in its signature — the multi-view
counterpart to `createLinearGenomeView`, and the primitive non-React hosts
(Jupyter anywidgets, R htmlwidgets, plain `<script>` pages) wrap. `react` and
`react-dom` are still peers: it saves you writing JSX and managing a React root,
not React itself.

One declarative `views` list reaches every view type, in the same
`{ type, init }` shape the [JSX synteny example](#synteny-example) uses. The
returned controller adds views (`controller.addView({ type, init })`) and tears
down (`controller.destroy()`).

**The stylesheet import is required** — without it the view manager's tabs
render unstyled. A host with no CSS loader can link
`node_modules/@jbrowse/react-app2/dist/styles.css` instead.
