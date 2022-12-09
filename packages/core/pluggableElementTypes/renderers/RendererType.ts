import React, { ReactElement } from 'react'
import { getDefaultValue } from '../../util/mst-reflection'
import PluggableElementBase from '../PluggableElementBase'
import { AnyConfigurationSchemaType } from '../../configuration/configurationSchema'
import { AnyReactComponentType } from '../../util'
import PluginManager from '../../PluginManager'

export type RenderProps = Record<string, unknown>

export interface RenderResults {
  reactElement?: ReactElement
  html?: string
}

export default class RendererType extends PluggableElementBase {
  ReactComponent: AnyReactComponentType

  supportsSVG = false

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

    if (!this.ReactComponent) {
      throw new Error(`no ReactComponent defined for renderer ${this.name}`)
    }
    if (!getDefaultValue(this.configSchema).type) {
      throw new Error(
        `${this.name} config schema ${this.configSchema.name} is not explicitlyTyped`,
      )
    }
    if (!this.pluginManager) {
      throw new Error(`no plugin manager defined for renderer ${this.name}`)
    }
  }

  async render(props: RenderProps): Promise<RenderResults> {
    return {
      reactElement: React.createElement(this.ReactComponent, props, null),
    }
  }

  /**
   * frees resources associated with the given range, session, etc.
   * optionally returns the number of data items deleted
   */
  freeResources(/* specification: {} */): number {
    return 0
  }
}
