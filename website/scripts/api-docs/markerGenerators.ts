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
import { writeMarkRuleDocs } from './generateMarkRuleDocs.ts'
import { writeMarkerIndexDocs } from './generateMarkerIndex.ts'
import { writeMenuDocs } from './generateMenuDocs.ts'
import { writeOrthofinderSetDocs } from './generateOrthofinderSetDocs.ts'
import { writePaletteDocs } from './generatePaletteDocs.ts'
import { writeReExportDocs } from './generateReExportDocs.ts'
import { writeSearchResultDocs } from './generateSearchResultDocs.ts'
import { writeShaderExportDocs } from './generateShaderExportDocs.ts'
import { writeShaderShapeDocs } from './generateShaderShapeDocs.ts'
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
// nothing else would gate them (`generate.ts --check` covers every doc it
// writes). It is what names the stale table by label, `markers.ts <label>`
// narrows a development loop to one table, and the whole set costs one
// TypeScript load rather than gendocs' whole-repo program.
export interface MarkerGenerator {
  // Names the table in the run's output, and what `markers.ts <filter>` matches.
  label: string
  // Returns the docs whose block changed; under `--check` none reach disk.
  write: (corpus: SourceCorpus) => string[]
}

export const MARKER_GENERATORS: MarkerGenerator[] = [
  { label: 'Color tables', write: writeColorDocs },
  { label: 'Jexl catalog', write: writeJexlDocs },
  { label: 'Adapter base table', write: writeAdapterBaseDocs },
  { label: 'BGZF pool sites', write: writeBgzfPoolSiteDocs },
  { label: 'Example plugin tree', write: writeExamplePluginDocs },
  { label: 'Search result field table', write: writeSearchResultDocs },
  { label: 'Shader export table', write: writeShaderExportDocs },
  { label: 'Shader shape consumers', write: writeShaderShapeDocs },
  { label: 'Menu tables', write: writeMenuDocs },
  { label: 'Extension point index', write: writeExtensionPointDocs },
  { label: 'LaunchView point table', write: writeLaunchViewDocs },
  { label: 'Element creation phases', write: writeElementPhaseDocs },
  { label: 'File type tables', write: writeFileTypeDocs },
  { label: 'Gated adapter budgets table', write: writeGatedBudgetDocs },
  { label: 'Display foundations table', write: writeDisplayFoundationDocs },
  { label: 'Cross-cutting mixins table', write: writeCrossCuttingMixinDocs },
  { label: 'Fetch autoruns table', write: writeFetchAutorunDocs },
  { label: 'Palette keys table', write: writePaletteDocs },
  { label: 'Helper package table', write: writeHelperPackageDocs },
  { label: 'Re-export module table', write: writeReExportDocs },
  { label: 'Slot type table', write: writeSlotTypeDocs },
  {
    // The one generator whose source is a build script rather than TypeScript.
    // Same reason as the rest: the tutorial was restating values the script
    // owns, and nothing connected the two.
    label: 'OrthoFinder set tables',
    write: writeOrthofinderSetDocs,
  },
  {
    // Source is a deployed demo config rather than TypeScript, for the same
    // reason again: four pages hand-carried the plugin URL a reader pastes,
    // and the configs serving it are tracked in this repo.
    label: 'Graph plugin config fence',
    write: writeGraphPluginDocs,
  },
  { label: 'Mark rule table', write: writeMarkRuleDocs },
  {
    // The index of every other entry in this list, and of the marker blocks the
    // whole-repo scan in generate.ts writes. Its source is the docs' own marker
    // pairs, so it belongs to no one generator and reads the same whichever run
    // invokes it — which is why it can sit here rather than at the end of
    // generate.ts, and so gets the `--check` gate the rest of this list has.
    label: 'Marker index',
    write: writeMarkerIndexDocs,
  },
]
