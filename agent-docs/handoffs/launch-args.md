---
name: launch-args
description: "One command-line grammar for jbrowse-img, jb2capture and JBrowse Desktop, in @jbrowse/launch-args. Landed: bare data files, the shared ADR-077 format table, Desktop opening 'jbrowse-desktop ref.fa reads.bam --loc ...', --hub renamed --genome, docs. Open: display modifiers in Desktop (a spec cannot carry five of them), img rendering through loadSessionSpec, jb2capture local files, the package's first npm publish."
---

# Launch arguments: one grammar for img, capture and Desktop

Started 2026-10-20 (GMOD/jbrowse-components#4303). The goal is docs that can
say "do this with jb2export, and launch Desktop the same way". None of the
packages is released, so breaking changes are fine.

## Where it lives

- `packages/launch-args/src/`: the tokenizer (`parseArgv.ts`, with the
  bare-file rule), file-to-config building through the add-track format table
  (`fileInput.ts`, `fileAdapter.ts` from `@jbrowse/cli`), Desktop's plan
  (`launchPlan.ts`), `--genome` URLs (`genome.ts`) and `--track` lookup
  (`trackIds.ts`, node-free, exported as the `./trackIds` subpath).
- Desktop: `electron/launchTarget.ts` (`findLaunchTarget` builds a plan or an
  `invalid` reason), `electron/electron.ts` (single-instance lock data,
  open-file), `src/components/StartScreen/launchFromLink.ts`
  (`launchFromPlan`).
- jb2export: `readData.ts` builds tracks with `fileTrack`; `main.ts` passes its
  boolean flags to the tokenizer.

## Traps

- **Chromium reorders a second launch's argv** in the `second-instance` event,
  switches first. The second instance sends its own `process.argv` and cwd as
  `requestSingleInstanceLock` data; `forwardedLaunch` reads it.
- **Unknown flags in Desktop's argv are Chromium or Electron switches**, which
  take values after `=`; `launchArgs` drops them before parsing, or a switch
  swallows the file after it.
- **jb2export's integration tests run the built `esm/`** of every workspace
  package; a stale `packages/launch-args/esm` fails them with errors that look
  like real bugs. `pnpm build:esm` in `products/jbrowse-img` first.

## Next, in order

1. **Display modifiers in Desktop.** Desktop reports `height:`, `color:` and
   the rest as not applied. Five cannot be written as session-spec keys today
   (`products/jbrowse-img/src/applyTrackOpts.ts` does them on a live model):
   - path keys merged onto the configured value (`"color.field"`,
     `"filterBy.flagExclude"`), since a whole-object write loses the default
     `flagExclude` and ADR-215 makes `color` whole; tag filters need an "add"
     form
   - a centre-sort intent resolved once the view has a centre (gene-name
     `--loc`)
   - a plugin-free track type → display category table, since `color:` and
     `featureHeight:` write different keys per category

   Then `buildDisplaySnapshot` (pure) moves to the package and both apps use it.
2. **img renders through `loadSessionSpec`**, deleting the live-model half of
   `applyTrackOpts`, so img and Desktop cannot drift.
3. **jb2capture local files.** It drives a web instance, so local files need
   serving to its browser: file:// fails (workers), a loopback server hits
   Chrome's local-network access checks from an https origin, and Puppeteer
   request interception is unverified for worker requests. Until then the docs
   sentence names jb2export and Desktop. capture still keeps its own copy of
   the genome URL (`products/jbrowse-capture/src/genome.ts`) to stay
   puppeteer-only.
4. **Comparative views from Desktop's command line** (`--fasta` twice, `--paf`):
   jb2export's `comparativeArgs.ts` has the grammar; Desktop's plan builds one
   linear view.
5. **Publish `@jbrowse/launch-args`.** `@jbrowse/cli`, `@jbrowse/img` and
   Desktop depend on it; its first npm publish needs a human.
