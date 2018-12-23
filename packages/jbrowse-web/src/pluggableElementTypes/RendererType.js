import React from 'react'
import PluggableElementType from './PluggableElementBase'

export default class RendererType extends PluggableElementType {
  constructor(stuff) {
    super(stuff)
    if (!this.ReactComponent)
      throw new Error(`no ReactComponent defined for renderer ${this.name}`)
  }

  render(props) {
    return { element: React.createElement(this.ReactComponent, props, null) }
  }

  /**
   * frees resources associated with the given range, session, etc.
   * optionally returns the number of data items deleted
   */
  freeResources(specification) {}
}
