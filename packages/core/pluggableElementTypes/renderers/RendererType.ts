import type { ReactElement } from 'react'
import React from 'react'
import PluggableElementBase from '../PluggableElementBase'
import type PluginManager from '../../PluginManager'
import type { AnyConfigurationSchemaType } from '../../configuration'
import type { AnyReactComponentType } from '../../util'

export type RenderProps = Record<string, unknown>

export interface RenderResults {
  reactElement?: ReactElement
  html?: string
}

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
