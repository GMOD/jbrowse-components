import type {
  AbstractSessionModel,
  Feature,
  StatusCallback,
  StopToken,
} from '@jbrowse/core/util'

export interface FileTypeExporter {
  name: string
  extension: string
  helpText?: string
  /**
   * The stop token and status callback are the pair every RPC on the export
   * path already carries. Most writers are string assembly and ignore both;
   * GenBank fetches the ORIGIN sequence, and without them closing the dialog
   * left a whole-gene read running with nothing waiting on it.
   */
  callback: (arg: {
    features: Feature[]
    session: AbstractSessionModel
    assemblyName: string
    stopToken?: StopToken
    statusCallback?: StatusCallback
  }) => Promise<string> | string
}
