import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface AssemblyManagerSession extends AbstractSessionModel {
  sessionAssemblies: AnyConfigurationModel[]
  addAssembly(conf: Record<string, unknown>): void
  removeAssembly(name: string): void
}
