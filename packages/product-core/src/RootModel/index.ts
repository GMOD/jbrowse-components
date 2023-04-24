import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'

export interface RootModel {
  jbrowse: AnyConfigurationModel
  session: AbstractSessionModel
  assemblyManager: ReturnType<typeof assemblyManagerFactory>
  version: string
}
