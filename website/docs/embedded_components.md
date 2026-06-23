---
title: Embedded components
---

Add a JBrowse view to your app as an npm package, or drop a single `<script>`
tag into any page — no build step required.

## Choosing a package

| Goal                                                      | Package                                                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full JBrowse UI (multiple views, synteny, import dialogs) | [`@jbrowse/react-app2`](https://www.npmjs.com/package/@jbrowse/react-app2) — [examples](https://jbrowse.org/storybook/app/)                                   |
| One linear genome view                                    | [`@jbrowse/react-linear-genome-view2`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view2) — [examples](https://jbrowse.org/storybook/lgv/)     |
| One circular genome view (e.g. SV chord diagrams)         | [`@jbrowse/react-circular-genome-view2`](https://www.npmjs.com/package/@jbrowse/react-circular-genome-view2) — [examples](https://jbrowse.org/storybook/cgv/) |
| No npm install, just a `<script>` tag                     | [Embedding tutorial](/docs/tutorials/embed_linear_genome_view)                                                                                                |

Not sure if you want an embedded view or the full app? See the
[FAQ entry](/docs/faq#embedded-views-versus-full-jbrowse-app).

## Quick start

```
npm install @jbrowse/react-linear-genome-view2 --legacy-peer-deps
```

```tsx
import {
  createViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'

const state = createViewState({ assembly, tracks })

export default function View() {
  return <JBrowseLinearGenomeView viewState={state} />
}
```

`@jbrowse/react-app2` and `@jbrowse/react-circular-genome-view2` work the same
way — swap in `JBrowseApp` or `JBrowseCircularGenomeView`. See
[initializing views](/docs/initializing_views) for the `assembly`, `tracks`, and
`location` options `createViewState` accepts.

## Bundler examples

| Package    | Bundler   | Demo                                            | Source                                                                              | Notes                |
| ---------- | --------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------- |
| react-app2 | next.js   | [demo](https://jbrowse.org/demos/app-nextjs)    | [source](https://github.com/GMOD/jbrowse-react-app-nextjs-demo)                     |                      |
| react-app2 | vite      | [demo](https://jbrowse.org/demos/app-vite)      | [source](https://github.com/GMOD/jbrowse-react-app-vite-demo)                       | webworker support    |
| react-app2 | rsbuild   | [demo](https://jbrowse.org/demos/app-rsbuild)   | [source](https://github.com/GMOD/jbrowse-react-app-rsbuild-demo)                    |                      |
| react-app2 | vanillajs | [demo](https://jbrowse.org/demos/app-vanillajs) | [source](https://github.com/GMOD/jbrowse-react-app-vanillajs-demo)                  |                      |
| lgv2       | vite      | [demo](https://jbrowse.org/demos/lgv-vite)      | [source](https://github.com/GMOD/jbrowse-react-linear-genome-view-vite-demo)        | webworker support    |
| lgv2       | rsbuild   | [demo](https://jbrowse.org/demos/lgv-rsbuild)   | [source](https://github.com/GMOD/jbrowse-react-linear-genome-view-rsbuild-demo)     |                      |
| lgv2       | next.js   | [demo](https://jbrowse.org/demos/lgv-nextjs)    | [source](https://github.com/GMOD/jbrowse-react-linear-genome-view-nextjs-demo)      | webworker support    |
| lgv2       | vanillajs | [demo](https://jbrowse.org/demos/lgv-vanillajs) | [source](https://github.com/GMOD/jbrowse-react-linear-genome-view-vanillajs-demo)   | script tag, no build |
| cgv2       | vanillajs | [demo](https://jbrowse.org/demos/cgv-vanillajs) | [source](https://github.com/GMOD/jbrowse-react-circular-genome-view-vanillajs-demo) | script tag, no build |
| cgv2       | next.js   | [demo](https://jbrowse.org/demos/cgv-nextjs)    | [source](https://github.com/GMOD/jbrowse-react-circular-genome-view-nextjs-demo)    |                      |

`react-app2` = `@jbrowse/react-app2`, `lgv2` =
`@jbrowse/react-linear-genome-view2`, `cgv2` =
`@jbrowse/react-circular-genome-view2`.
