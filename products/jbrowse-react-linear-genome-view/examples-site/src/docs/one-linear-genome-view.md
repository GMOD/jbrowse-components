```bash
npm install @jbrowse/react-linear-genome-view2
```

The view renders on the client only: in Next.js, load it through `next/dynamic`
with `{ ssr: false }`. Add
[`@fontsource/roboto`](https://www.npmjs.com/package/@fontsource/roboto), or the
chrome falls back to the theme's next font, Helvetica or Arial.

`view` is read once, when the view is created: re-rendering with a different
`loc` does not move it. To drive the view afterwards, take a `ref` and call its
[navigation actions](../external-navigate/).
