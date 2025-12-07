import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

export interface FileTypeExporter {
  name: string
  extension: string
  helpText?: string
  callback: (arg: {
    features: Feature[]
    session: AbstractSessionModel
    assemblyName: string
  }) => Promise<string> | string
}
