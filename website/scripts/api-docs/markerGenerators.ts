import { writeConfigSpellings } from '../../../scripts/generateConfigSpellings.ts'
import { writeDiagramUsage } from '../gen-diagram-usage.ts'
import { writeAbiRemovals } from '../generate-abi-removals.ts'
import { writeAdrIndex } from '../generate-adr-index.ts'
import { writeCaptureDoc } from '../generate-capture-doc.ts'
import { writeCliDoc } from '../generate-cli-doc.ts'
import { writeDisplayChromeAdoption } from '../generate-display-chrome-adoption.ts'
import { writeDisplayHookOverrides } from '../generate-display-hook-overrides.ts'
import { writeDisplayStateCensus } from '../generate-display-state-census.ts'
import { writeDocIndexes } from '../generate-doc-indexes.ts'
import { writeFreshnessCensus } from '../generate-freshness-census.ts'
import { writeGuideIndexes } from '../generate-guide-indexes.ts'
import { writeMeasurementTables } from '../generate-measurement-tables.ts'
import { writeTodoIndex } from '../generate-todo-index.ts'
import { writeDocSnippets } from '../sync-doc-snippets.ts'
import { writeInlineFigures } from '../sync-inline-figures.ts'
import { writePublishedMeasurements } from '../sync-measurements.ts'
import { writeAdapterBaseDocs } from './generateAdapterBaseDocs.ts'
import { writeBgzfPoolSiteDocs } from './generateBgzfPoolSiteDocs.ts'
import { writeColorDocs } from './generateColorDocs.ts'
import { writeColorChannelDocs } from './generateConfigDocs.ts'
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
import { writeTutorialInstallDocs } from './generateTutorialInstallDocs.ts'

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

// The markers generate.ts writes from the whole-repo TypeScript program, which
// markers.ts does not build. Named so a markers.ts run can tell a block nobody
// writes from one gendocs writes; generate.ts fails when one goes unwritten.
export const PROGRAM_MARKERS = [
  'DISPLAY_TYPES',
  'DISPLAY_VIEW_TYPES',
  'GOTCHA',
  'SPEC_KEYS',
] as const

// In order: a generator reading a doc another one writes comes after it, and
// reads it through `readDoc`, so it sees this run's text rather than disk's.
export const MARKER_GENERATORS: MarkerGenerator[] = [
  { label: 'Guide indexes', write: writeGuideIndexes },
  // Reads the <Figure> lines the guide indexes write into developer_guide.md.
  { label: 'Diagram usage table', write: writeDiagramUsage },
  { label: 'CLI doc', write: writeCliDoc },
  { label: 'jbrowse-capture doc', write: writeCaptureDoc },
  // Its fence ratchet counts the mirrored jbrowse-capture.md.
  { label: 'Doc snippets', write: writeDocSnippets },
  { label: 'ADR index', write: writeAdrIndex },
  { label: 'Doc indexes', write: writeDocIndexes },
  { label: 'Backlog index', write: writeTodoIndex },
  // From the two ABI baselines, core's published `exports` map,
  // reExports.generated.json and publishedPluginBreaks.json.
  { label: 'ABI removal tables', write: writeAbiRemovals },
  { label: 'DisplayChrome adoption map', write: writeDisplayChromeAdoption },
  { label: 'Display hook override table', write: writeDisplayHookOverrides },
  { label: 'Display state census', write: writeDisplayStateCensus },
  { label: 'Freshness signature census', write: writeFreshnessCensus },
  // From the committed config JSON schema the config schema manifest writes.
  { label: 'Config spellings', write: writeConfigSpellings },
  // The tables in the agent-docs owning each measurement, then the public
  // pages' copies of them, then single values a sentence quotes out of one.
  { label: 'Measurement tables', write: writeMeasurementTables },
  { label: 'Published measurement tables', write: writePublishedMeasurements },
  { label: 'Inline figures', write: writeInlineFigures },
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
  { label: 'Color channel table', write: writeColorChannelDocs },
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
  { label: 'Tutorial install fences', write: writeTutorialInstallDocs },
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
