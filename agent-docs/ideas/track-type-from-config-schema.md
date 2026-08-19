---
name: track-type-from-config-schema
description: adapterTypesToTrackTypeMap restates the #trackType tag every adapter config schema already carries; generating it would close the last hand-copied half of the add-track table.
---

# Generate adapterTypesToTrackTypeMap from `#trackType`

`packages/add-track-core/src/formats.ts` ends with a hand-written
`adapterTypesToTrackTypeMap`. Every adapter in it already declares the same fact
in its config schema's JSDoc:

```ts
/**
 * #config BedpeAdapter
 * #trackType VariantTrack
 */
```

`website/scripts/api-docs/generateFileTypeDocs.ts` reads exactly that tag to
build the "Supported file types" table, so the tag is already load-bearing and
already parsed. The map is a second copy of it, kept by hand.

Checked 2026-08-19: the two agree on all 27 shared adapters. Every adapter
carrying a `#trackType` but absent from the map resolves to the `FeatureTrack`
default, or has no extension guess at all (the MAF adapters, `HtsgetBamAdapter`,
the `FromConfig*` family, the text-search adapters) — so nothing is wrong today,
there is just nothing stopping it going wrong.

The reason it is still hand-written: `@jbrowse/add-track-core` has no
dependencies and the CLI cannot parse TypeScript, so the tag cannot be read at
runtime on either side. Closing it means **generating** the map, the way
`configManifest.generated.ts` is generated — `scripts/generateConfigManifest.ts`
already walks every config schema for the CLI's validate command, but collects
slots and shorthand keys rather than `#trackType`. Adding the tag to what it
collects, and emitting the map beside the manifest, is the shape.

Cheaper interim: have `writeFileTypeDocs` throw when a `#trackType` tag
disagrees with the map, since it holds both. That is a check rather than a
single source, but `pnpm autogen --check` runs in CI.
