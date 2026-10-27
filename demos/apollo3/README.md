# apollo3

Apollo 3 editing annotations in JBrowse with no collaboration server, over the
Tiberius prediction on human chr22. Deployed at
https://jbrowse.org/demos/apollo3/.

`config.json` names no `internetAccounts`, and that absence is the whole switch:
Apollo's `ClientDataStore.getBackendDriver` reads `internetAccountConfigId` off
the assembly's `sequence.metadata` and falls through to its `LocalDriver`, which
keeps annotations in IndexedDB. The plugin adds its own
`apollo_track_<assembly>` once the assembly loads, and the default session opens
it by name.

Two files in the deployed directory have no repo copy, because both are build
artifacts:

- `jbrowse-plugin-apollo.umd.production.min.js`, built from GMOD/Apollo3's `v2`
  branch (PR #863, which carries #846 "Update to JBrowse 2 v5") at `49e0117a`,
  plus a local commit raising its `@jbrowse/*` ranges to `5.0.0-beta.18` and
  `@jbrowse/mobx-state-tree` to `^6.10.0`. The published 1.2.0 bundle
  peer-depends `@jbrowse/core@^4.3.0` and breaks against v5 (the Apollo row in
  `packages/core/src/ReExports/publishedPluginBreaks.json`).
- `so-2024-11-18.json`, the Sequence Ontology, copied from the Apollo repo's
  `test_data`. The plugin otherwise fetches 2.2 MB from
  raw.githubusercontent.com on every load;
  `configuration.ApolloPlugin.ontologies` points it here instead.

Deploy those two with `DEPLOY_DEMO_ALLOW_UNTRACKED=1`.

To rebuild the bundle: check out `v2` and run
`yarn workspace @apollo-annotation/jbrowse-plugin-apollo run build`. Yarn PnP
builds it; the `nodeLinker: node-modules` workaround the older #823 branch
needed is gone. Before building, check `yarn.lock` holds one
`@jbrowse/mobx-state-tree`: a second copy beside core's fails the typecheck with
hundreds of MST errors.

## Known limitations

Frank list, so nobody rediscovers these by being surprised.

- **The bundle is built from an unreleased branch.** `v2` collects Apollo 3 v2
  and fast-forwards onto Apollo's main at release. If it is reworked first, this
  bundle needs rebuilding, and the demo can break without anything here
  changing. Retire the local build once Apollo publishes a release that
  peer-depends `@jbrowse/core@^5`.
- **Edits live in one browser and are not backed up.** IndexedDB, scoped to the
  origin, so clearing site data for jbrowse.org loses them and nothing syncs
  between machines or people. Download GFF3 is the only durable output. A review
  that needs more than one annotator wants the collaboration server, which is
  what this demo is deliberately doing without.
- **No text search over the annotations.** `LocalDriver.searchFeatures` returns
  an empty list, so the location box finds nothing in the Apollo track and the
  `LinearGenomeView-searchResultSelected` hook for `apollo_track_*` never fires.
- **The demo pins `code/jb2/v5.0.0-beta.18/`**, which is what the plugin
  peer-depends on. The pin has to move with the plugin rather than with our
  releases; pointing it at `main` breaks the day core drifts from what the
  bundle was built against.
- **Two config keys are the plugin's**, declared at runtime:
  `configuration.ApolloPlugin` and the `apollo_track_hg38` the session opens.
  The repo's validator cannot check either and warns about both. Both were
  checked in a browser: the ontology loads from the pinned URL and not from
  GitHub, and the track opens from the session spec, with nothing logged.
