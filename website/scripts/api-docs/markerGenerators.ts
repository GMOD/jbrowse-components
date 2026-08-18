import { writeAdapterBaseDocs } from './generateAdapterBaseDocs.ts'
import { writeBgzfPoolSiteDocs } from './generateBgzfPoolSiteDocs.ts'
import { writeColorDocs } from './generateColorDocs.ts'
import { writeCrossCuttingMixinDocs } from './generateCrossCuttingMixinDocs.ts'
import { writeDisplayFoundationDocs } from './generateDisplayFoundationDocs.ts'
import { writeElementPhaseDocs } from './generateElementPhaseDocs.ts'
import { writeExamplePluginDocs } from './generateExamplePluginDocs.ts'
import { writeExtensionPointDocs } from './generateExtensionPointDocs.ts'
import { writeFetchAutorunDocs } from './generateFetchAutorunDocs.ts'
import { writeFileTypeDocs } from './generateFileTypeDocs.ts'
import { writeGatedBudgetDocs } from './generateGatedBudgetDocs.ts'
import { writeGraphPluginDocs } from './generateGraphPluginDocs.ts'
import { writeHelperPackageDocs } from './generateHelperPackageDocs.ts'
import { writeJexlDocs } from './generateJexlDocs.ts'
import { writeLaunchViewDocs } from './generateLaunchViewDocs.ts'
import { writeMarkerIndexDocs } from './generateMarkerIndex.ts'
import { writeMenuDocs } from './generateMenuDocs.ts'
import { writeOrthofinderSetDocs } from './generateOrthofinderSetDocs.ts'
import { writePaletteDocs } from './generatePaletteDocs.ts'
import { writeReExportDocs } from './generateReExportDocs.ts'
import { writeSearchResultDocs } from './generateSearchResultDocs.ts'
import { writeShaderExportDocs } from './generateShaderExportDocs.ts'
import { writeSlotTypeDocs } from './generateSlotTypeDocs.ts'

import type { SourceCorpus } from './util.ts'

// Every marker-block generator that needs nothing from the TypeScript program —
// one list, so `generate.ts` (which writes them as part of a full run) and
// `markers.ts` (which is what `pnpm autogen` invokes to verify them) cannot
// disagree about the set.
//
// They were ten separate autogen entries, each its own `node` process, and each
// paid ~2.5s to `import typescript` before doing its own walk of the source
// tree — `generateColorDocs` parses exactly one file and still took 2.7s. A run
// therefore spent ~25s on process startup alone, and then `pnpm gendocs`
// generated all ten again in its own process, because generate.ts calls the
// same writers.
//
// Keeping a `--check` of their own is still right, though no longer because
// nothing else would gate them (`gendocs`'s autogen entry diffs all of
// `website/docs` and `agent-docs` now). It is what names the stale table:
// gendocs' diff can only say "config/model/api docs". `markers.ts <label>`
// narrows a development loop to one table, and the whole set costs one
// TypeScript load rather than gendocs' whole-repo program.
export interface MarkerGenerator {
  // Names the table in the run's output, and what `markers.ts <filter>` matches.
  label: string
  // Returns the docs whose block content changed (empty when up to date).
  write: (corpus: SourceCorpus, opts: { check: boolean }) => string[]
}

export const MARKER_GENERATORS: MarkerGenerator[] = [
  {
    label: 'Color tables',
    write: (_corpus, opts) => writeColorDocs(opts),
  },
  {
    label: 'Jexl catalog',
    write: (corpus, opts) => writeJexlDocs(corpus, opts),
  },
  {
    label: 'Adapter base table',
    write: (_corpus, opts) => writeAdapterBaseDocs(opts),
  },
  {
    label: 'BGZF pool sites',
    write: (corpus, opts) => writeBgzfPoolSiteDocs(corpus, opts),
  },
  {
    label: 'Example plugin tree',
    write: (_corpus, opts) => writeExamplePluginDocs(opts),
  },
  {
    label: 'Search result field table',
    write: (_corpus, opts) => writeSearchResultDocs(opts),
  },
  {
    label: 'Shader export table',
    write: (_corpus, opts) => writeShaderExportDocs(opts),
  },
  {
    label: 'Menu tables',
    write: (corpus, opts) => writeMenuDocs(corpus, opts),
  },
  {
    label: 'Extension point index',
    write: (corpus, opts) => writeExtensionPointDocs(corpus, opts),
  },
  {
    label: 'LaunchView point table',
    write: (corpus, opts) => writeLaunchViewDocs(corpus, opts),
  },
  {
    label: 'Element creation phases',
    write: (_corpus, opts) => writeElementPhaseDocs(opts),
  },
  {
    label: 'File type tables',
    write: (corpus, opts) => writeFileTypeDocs(corpus, opts),
  },
  {
    label: 'Gated adapter budgets table',
    write: (_corpus, opts) => writeGatedBudgetDocs(opts),
  },
  {
    label: 'Display foundations table',
    write: (corpus, opts) => writeDisplayFoundationDocs(corpus, opts),
  },
  {
    label: 'Cross-cutting mixins table',
    write: (corpus, opts) => writeCrossCuttingMixinDocs(corpus, opts),
  },
  {
    label: 'Fetch autoruns table',
    write: (_corpus, opts) => writeFetchAutorunDocs(opts),
  },
  {
    label: 'Palette keys table',
    write: (_corpus, opts) => writePaletteDocs(opts),
  },
  {
    label: 'Helper package table',
    write: (corpus, opts) => writeHelperPackageDocs(corpus, opts),
  },
  {
    label: 'Re-export module table',
    write: (_corpus, opts) => writeReExportDocs(opts),
  },
  {
    label: 'Slot type table',
    write: (_corpus, opts) => writeSlotTypeDocs(opts),
  },
  {
    // The one generator whose source is a build script rather than TypeScript.
    // Same reason as the rest: the tutorial was restating values the script
    // owns, and nothing connected the two.
    label: 'OrthoFinder set tables',
    write: (_corpus, opts) => writeOrthofinderSetDocs(opts),
  },
  {
    // Source is a deployed demo config rather than TypeScript, for the same
    // reason again: four pages hand-carried the plugin URL a reader pastes,
    // and the configs serving it are tracked in this repo.
    label: 'Graph plugin config fence',
    write: (_corpus, opts) => writeGraphPluginDocs(opts),
  },
  {
    // The index of every other entry in this list, and of the marker blocks the
    // whole-repo scan in generate.ts writes. Its source is the docs' own marker
    // pairs, so it belongs to no one generator and reads the same whichever run
    // invokes it — which is why it can sit here rather than at the end of
    // generate.ts, and so gets the `--check` gate the rest of this list has.
    label: 'Marker index',
    write: (_corpus, opts) => writeMarkerIndexDocs(opts),
  },
]
