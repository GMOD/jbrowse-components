import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyReactComponentType } from '../util/index.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

export default class ConnectionType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: AnyConfigurationSchemaType

  description: string

  url: string

  configEditorComponent?: AnyReactComponentType

  fetchTracks?: (
    config: Record<string, unknown>,
  ) => Promise<Record<string, unknown>[]>

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    configSchema: AnyConfigurationSchemaType
    displayName: string
    description: string
    configEditorComponent?: AnyReactComponentType
    url: string
    fetchTracks?: (
      config: Record<string, unknown>,
    ) => Promise<Record<string, unknown>[]>
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    this.description = stuff.description
    this.url = stuff.url
    this.configEditorComponent = stuff.configEditorComponent
    this.fetchTracks = stuff.fetchTracks
  }
}
