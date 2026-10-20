---
name: launch-args
description: "One command-line grammar for jbrowse-img, jb2capture and JBrowse Desktop: each turns argv into a session spec, and only the last step differs (render, screenshot, open a window). Goal: docs that say 'do this with jbrowse-img... and launch Desktop the same way'. Closes GMOD/jbrowse-components#4303 properly. In progress; none of these packages is released, so breaking changes are fine."
---

# Launch arguments: one grammar for img, capture and Desktop

Started 2026-10-20. Desktop today takes a `.jbrowse`, a `config.json` or a
`jbrowse://` link on argv (`products/jbrowse-desktop/electron/launchTarget.ts`)
and shows a "cannot open" notice for a data file (`findUnopenableFile`), which
this thread replaces.

## Grammar

| Argument | Meaning |
| --- | --- |
| `--genome hg38` / `--config path\|URL` | where assemblies and tracks come from (`--genome` replaces img/capture's `--hub`, which collides with urlparams `hubURL=`, a UCSC track hub) |
| `--fasta`, `--chromSizes`, `--aliases`, `--cytobands` | an assembly from files |
| `--bam`, `--cram`, `--vcfgz`, `--gffgz`, `--bigwig`, ... `file [mods]` | a file as a track, typed |
| bare `reads.bam` | the same, typed by extension |
| `--track id [mods]` | a trackId from the genome or config |
| `--assembly`, `--loc` | which assembly, and where |
| `--spec`, `--session` | anything flags cannot say |
| `--out` | img and capture only |

**Positional rule.** img's `parseArgv` attaches every token after a flag to
that flag, so `--loc chr1:1-100 reads.bam` drops the BAM. A modifier is
`<registered name>:` or `<registered name>=`; any other token with a known data
extension, or a URL, is a positional file; anything else is an error. A ':'
test alone fails on locstrings, URLs and `C:\` paths.

## Next, in order

1. **`@jbrowse/launch-args`**, a Node package (not core: everything core exports
   is plugin ABI, and this needs `fs` for sibling index files). Pure argv →
   `{ config pieces, spec | session snapshot }`, from img's `parseArgv`,
   `makeConfigs`, `readData`, `comparativeArgs`, `spec`. Imports only narrow
   core subpaths. img switches to it. First npm publish needs a human.
2. **Desktop** consumes it: a `LaunchTarget` `{ type: 'spec' }` built only
   from argv, never from a `jbrowse://` link, so a link cannot yield a
   `localPath`. A `--genome`/`--config` URL goes through the renderer's
   `fetchConfig` so the plugin-trust gate runs; the main process does not fetch
   it. Only plain-slot modifiers at first (`height`, `force`, `display`,
   `heightMode`, `arcs`, `sashimi`, `baseColor`, a constant `color`).
3. **Spec extensions in core** for what a spec cannot say today
   (`plugins/.../applyTrackOpts.ts` does these on a live model):
   - path keys merged onto the configured value (`"color.field"`,
     `"filterBy.flagExclude"`), since a whole-object write loses the default
     `flagExclude` and ADR-215 makes `color` whole; tag filters need an "add"
     form
   - a centre-sort intent resolved once the view has a centre (gene-name
     `--loc`)
   - a plugin-free track type → display category table, since `color:` and
     `featureHeight:` write different keys per category
4. **img renders through `loadSessionSpec`**, deleting the live-model half of
   `applyTrackOpts`. Without this, img and Desktop drift.
5. **One "Launch arguments" docs page**; the img, capture and Desktop pages
   link it with their own extra flags.
6. **capture** moves onto the module last. Local files need serving to its
   browser: file:// fails (workers), a loopback server hits Chrome's
   local-network access checks from an https origin, and Puppeteer request
   interception is unverified for worker requests. Until then capture refuses a
   local path with a clear error, and the docs sentence names img and Desktop.
