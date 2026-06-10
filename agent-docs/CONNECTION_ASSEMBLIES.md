# TODO: UCSC multi-genome hubs silently skip unloaded assemblies

## Problem

`plugins/data-management/src/UCSCTrackHubConnection/doConnect.ts` has two paths:

- **single-file hub** (`useOneFile on`): auto-registers the assembly via
  `generateAssembly(genome, hubUri)` → `session.addSessionAssembly?.(...)` when
  it isn't already known.
- **multi-genome hub** (genomes.txt): does **not** add missing assemblies. For
  each genome whose assembly isn't already loaded it just does
  `notLoadedAssemblies.push(genomeName)` and `continue`, then notifies
  *"Skipped data from these assemblies: …"*.

So connecting a standard multi-genome UCSC hub against a JBrowse instance that
doesn't already have those assemblies loads **zero tracks** and dead-ends the
user, even though the hub's `genomes.txt` carries enough info to build the
assembly (the single-file path already proves this).

## Proposed fix

In the multi-genome branch, when `assemblyManager.get(genomeName)` returns
nothing, build and register the assembly instead of skipping it — mirror the
single-file branch:

```ts
const asm = assemblyManager.get(genomeName)
if (!asm) {
  session.addSessionAssembly?.(generateAssembly(genome, genomesBaseUri))
}
```

Then drop `notLoadedAssemblies` and the "Skipped data" notification, or keep it
only for genomes where assembly generation genuinely fails.

## Open questions / things to verify

- `generateAssembly` currently takes the single-file-hub `genome` shape. Confirm
  the per-genome object from `GenomesFile` (the `genome` in the
  `Object.entries(genomesFile.data)` loop) carries the fields it needs
  (`twoBitPath`/`description`/`defaultPos`/etc.) — see
  `UCSCTrackHubConnection/generateAssembly.ts`. May need a variant for the
  genomes.txt shape.
- Base URI: single-file uses `hubUri`; multi-genome resolves against
  `genomesBaseUri`. Make sure the generated assembly's sequence location
  resolves correctly relative to the right base.
- `addSessionAssembly` is optional on the session — keep the `?.` guard and
  decide behavior when it's absent (admin/config-only sessions).
- Decide whether to respect the connection's `assemblyNames` filter the same way
  the track loop already does (only add assemblies the user opted into).
- Add a test in `AddConnectionWidget.test.tsx` (or a doConnect-level test) for a
  multi-genome hub against a session with **no** preloaded assembly, asserting
  the assembly + tracks get added.

## Related

- Single-file path already does the right thing — use it as the reference.
- JB2 connection (`JB2TrackHubConnection/doConnect.ts`) already auto-adds
  `configJson.assemblies`, so it's another reference for the desired UX.
