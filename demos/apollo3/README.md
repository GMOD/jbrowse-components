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

- `jbrowse-plugin-apollo.umd.production.min.js`, built from GMOD/Apollo3 PR #823
  (the JBrowse 5 branch), since the published 1.1.2 bundle peer-depends
  `@jbrowse/core@^4.3.0` and breaks against v5 -- see the Apollo row in
  `packages/core/src/ReExports/publishedPluginBreaks.json`.
- `so-2024-11-18.json`, the Sequence Ontology, copied from the Apollo repo's
  `test_data`. The plugin otherwise fetches 2.2 MB from
  raw.githubusercontent.com on every load;
  `configuration.ApolloPlugin.ontologies` points it here instead.

Deploy those two with `DEPLOY_DEMO_ALLOW_UNTRACKED=1`.

To rebuild the bundle: check out PR #823, add `nodeLinker: node-modules` to
`.yarnrc.yml` (under Yarn PnP the build fails claiming `IMSTArray` has no
`length`/`map`, which is a PnP resolution failure rather than a real type
error), then
`yarn workspace @apollo-annotation/jbrowse-plugin-apollo run build`.

## Known limitations

Frank list, so nobody rediscovers these by being surprised.

- **The bundle is built from an unmerged branch.** PR #823 is open, unreviewed
  and conflicting with Apollo's main. If it is reworked before it lands, this
  bundle needs rebuilding against whatever replaced it, and the demo can break
  without anything here changing. Retire the local build once Apollo publishes a
  release that peer-depends `@jbrowse/core@^5`.
- **Edits live in one browser and are not backed up.** IndexedDB, scoped to the
  origin, so clearing site data for jbrowse.org loses them and nothing syncs
  between machines or people. Download GFF3 is the only durable output. A review
  that needs more than one annotator wants the collaboration server, which is
  what this demo is deliberately doing without.
- **No text search over the annotations.** `LocalDriver.searchFeatures` returns
  an empty list, so the location box finds nothing in the Apollo track and the
  `LinearGenomeView-searchResultSelected` hook for `apollo_track_*` never fires.
- **The demo pins `code/jb2/v5.0.0-beta.8/`**, which is what the plugin
  peer-depends on. The pin has to move with the plugin rather than with our
  releases; pointing it at `main` breaks the day core drifts from what the
  bundle was built against.
- **Two config keys are the plugin's**, declared at runtime:
  `configuration.ApolloPlugin` and the `apollo_track_hg38` the session opens.
  The repo's validator cannot check either and warns about both. Both were
  checked in a browser: the ontology loads from the pinned URL and not from
  GitHub, and the track opens from the session spec, with nothing logged.
