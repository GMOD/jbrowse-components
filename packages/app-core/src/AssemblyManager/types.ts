import type { BaseAssemblyConfigModel } from '@jbrowse/core/assemblyManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export interface AssemblyManagerSession extends AbstractSessionModel {
  sessionAssemblies: BaseAssemblyConfigModel[]
  addAssembly(conf: Record<string, unknown>): void
  removeAssembly(name: string): void
}
