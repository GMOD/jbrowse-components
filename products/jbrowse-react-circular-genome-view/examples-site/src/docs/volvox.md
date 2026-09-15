```bash
npm install @jbrowse/react-circular-genome-view2
```

The props are read once, on mount; to drive the view afterwards, see
[show a track](../show-track/). It renders on the client only, so in Next.js
load it through `next/dynamic` with `{ ssr: false }`.
