import type {
  AbstractSessionModel,
  Feature,
  Region,
  StatusCallback,
} from '@jbrowse/core/util'

/**
 * Which of a display's features a file holds: the ones it draws, or every one
 * it counts — a coverage depth is a measure over the reads the band counts,
 * which a filter on the drawn reads leaves whole.
 */
export type ExportedFeatureSet = 'drawn' | 'counted'

/**
 * What a display that answers the export itself (`fetchExportedFeatures`) is
 * asked for: the regions the dialog names, and which features the format
 * writes.
 */
export interface ExportedFeaturesRequest {
  regions: Region[]
  featureSet: ExportedFeatureSet
  signal?: AbortSignal
  statusCallback?: StatusCallback
}

export interface ExportedFeatures {
  features: Feature[]
  /** the fetched features the display hides, and so the file leaves out */
  filteredOut: number
}

export interface FileTypeExporter {
  name: string
  extension: string
  helpText?: string
  /** `drawn` when unset */
  featureSet?: ExportedFeatureSet
  /**
   * The signal and status callback are the pair every RPC on the export
   * path already carries. Most writers are string assembly and ignore both;
   * GenBank fetches the ORIGIN sequence, and without them closing the dialog
   * left a whole-gene read running with nothing waiting on it. `regions` are
   * what was exported, in the assembly's names, for a writer whose rows are
   * positions rather than features (a coverage depth).
   */
  callback: (arg: {
    features: Feature[]
    session: AbstractSessionModel
    assemblyName: string
    regions: Region[]
    signal?: AbortSignal
    statusCallback?: StatusCallback
  }) => Promise<string> | string
}
