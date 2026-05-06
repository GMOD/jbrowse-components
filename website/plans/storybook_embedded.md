# Storybook / Embedded component plan

## useCreateViewState hook

- Add a `useCreateViewState` hook exported from `@jbrowse/react-linear-genome-view2`
  that wraps `createViewState` in `useMemo` internally
- This eliminates the footgun of re-creating state on every render without
  requiring users to know about memoization
- Add a storybook story demonstrating the hook as the canonical usage pattern
- Update `embed_linear_genome_view.md` tutorial to use the hook

## Synteny example in @jbrowse/react-app2 storybook

- The LGV storybook has synteny examples but the app storybook does not
- Add a story showing a dotplot or linear synteny view opened in the app component

## Observer/MobX usage storybook page

- Observer examples currently only appear in source code examples
- Add a proper doc-type story explaining when and why to use `observer`, with
  a live example

## Adding tracks programmatically in @jbrowse/react-app2

- No docs or storybook examples exist for this
- Add a story showing `session.addTrackConf(trackConfig)` + `view.showTrack(trackId)`
- Note in `embedded_components.md` that `jbrowse add-track --out <config>` also
  works since the config format is identical to jbrowse-web

## Embedded plugin technique

- The no-build plugin tutorial targets jbrowse-web; embedded apps use a
  different approach (passing `plugins` array to `createViewState`)
- Add a storybook story showing a minimal embedded plugin
- Add a note in the no-build plugin tutorial pointing embedded users to this

## Embedded component comparison

- `embedded_components.md` lists packages but gives no guidance on choosing
- Add a decision table:

| Goal | Package |
|---|---|
| Full JBrowse UI in a React app | `@jbrowse/react-app2` |
| Single LGV, API-controlled data | `@jbrowse/react-linear-genome-view2` |
| Static deployment, no build step | jbrowse-web |

- Link each row to the relevant storybook and demo repos
