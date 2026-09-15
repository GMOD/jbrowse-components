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
