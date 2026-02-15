import type React from 'react'

import PluggableElementBase from '../PluggableElementBase.ts'

import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationSchemaType } from '../../configuration/index.ts'
import type { AnyReactComponentType } from '../../util/index.ts'
import type { RpcResult } from '../../util/librpc.ts'

export type RenderProps = Record<string, unknown>

export interface RenderResults {
  reactElement?: React.ReactElement
  html?: string
  [key: string]: unknown
}

export type RenderReturn = RenderResults | RpcResult

export default class RendererType extends PluggableElementBase {
  ReactComponent: AnyReactComponentType

  supportsSVG = true

  configSchema: AnyConfigurationSchemaType

  pluginManager: PluginManager

  constructor(stuff: {
    name: string
    ReactComponent: AnyReactComponentType
    displayName?: string
    configSchema: AnyConfigurationSchemaType
    pluginManager: PluginManager
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.configSchema = stuff.configSchema
    this.pluginManager = stuff.pluginManager
  }

  async render(props: RenderProps): Promise<RenderReturn> {
    return {
      reactElement: <this.ReactComponent {...props} />,
    }
  }

  freeResources(_args: any) {}
}
