import type {
  AbstractSessionModel,
  Feature,
  Region,
  StatusCallback,
} from '@jbrowse/core/util'

export interface FileTypeExporter {
  name: string
  extension: string
  helpText?: string
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
