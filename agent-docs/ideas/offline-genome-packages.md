---
name: offline-genome-packages
description: Relocatable genome packs plus a download manager for jbrowse-desktop: the existing hooks, the approaches, the size reality, and a recommendation.
---

# Offline genome packages for jbrowse-desktop

Goal: let users download an offline "package" for key genomes (human hg38/hg19,
mouse, etc.) so jbrowse-desktop works well with no internet.

### Existing hooks

- **Quickstart system** (`electron/ipc/quickstartHandlers.ts`, `paths.ts`):
  pre-baked sessions in `userData/quickstart/*.json`. Legacy hg19/hg38/mm10
  quickstarts exist. Natural hook for "install a genome".
- **Path resolution** (`packages/core/src/util/io/index.ts:40`
  `resolveUriLocation`): URIs resolve relative to `baseUri` via
  `new URL(uri, baseUri)`. But `LocalPathLocation` is stored as an **absolute
  path** — the main blocker for a relocatable bundle.
- **faiDir** (`userData/fai`): indexes already cached separately.

Fundamental gap: offline = local data files + config with **portable paths**.
Nothing currently makes a genome's data relocatable.

### Approaches

**A. Relocatable "genome pack" (foundation).** Self-contained folder shipped as
a `.zip`:
```
hg38-minimal/
  config.json          # assembly + gene track, relative paths
  data/hg38.fa.gz + .fai + .gzi
  data/ncbiRefSeq.gff.gz + .tbi
```
Unlock: teach desktop's `LocalPathLocation` to resolve relative to the config
file's dir (mirror existing `baseUri` logic). Works wherever extracted; also
shareable peer-to-peer (USB / lab share) — big for air-gapped users.

**B. In-app download manager + registry.** Curated `genomes.json` catalog on
jbrowse.org (name, size, URL, checksum). App lists packs → user picks → download
into `userData/genomes/hg38/` → register a quickstart. Net once, then fully
offline. Reuse cross-repo download-progress plumbing (genfh2/tabix/bam
onProgress) for resumable progress UI. Natural home for config-minimal vs
config-full variants.

**C. Bundle-at-install (config-minimal seed).** Ship tiny assembly config + gene
model in the installer; FASTA fetched-and-cached on first use. Small installer
but not truly offline until browsed. Weakest fit.

**D. Persistent HTTP range cache.** Cache fetched byte-ranges to disk so
revisited regions work offline. Complementary, never gives a whole genome.

### Size reality

hg38 FASTA bgzip ~900MB-1GB; gene models tiny. config-minimal ~= FASTA + faidx +
one gene track ~1GB. Offer two SKUs per genome: *minimal* (ref + genes) and
*full* (adds GC, repeats, clinvar, etc.).

### Recommendation

Build **A as the format, B as the delivery**: relocatable genome-pack format +
download-manager UI backed by a registry, each install registered as a
quickstart. A also gives free offline sharing without a server.

### Make the app generally offline-friendly

Audit startup/runtime net calls that degrade offline: plugin-store fetch,
autoUpdater check (`electron/autoUpdater.ts`), internet-account probing. These
should fail fast/silent offline instead of hanging or erroring noisily.
