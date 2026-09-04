import LazyStateModelElement from './LazyStateModelElement.ts'

import type { LaunchKeyRegistration } from '../util/withLaunchInput.ts'
import type DisplayType from './DisplayType.ts'
import type { IAnyModelType, IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

type BasicView = React.ComponentType<{
  // TODO: can we use AbstractViewModel here?

  model: any
  session?: IAnyStateTreeNode
}>

type ViewComponentType = React.LazyExoticComponent<BasicView> | BasicView

interface ViewMetadata {
  hiddenFromGUI?: boolean
}

export default class ViewType extends LazyStateModelElement {
  protected readonly group = 'view'

  ReactComponent: ViewComponentType

  // What `withLaunchInput` partitioned out of this view's snapshots, published
  // beside the model so an out-of-tree plugin, the doc generator and the
  // validator read one declaration rather than each keeping a list.
  launchKeys?: LaunchKeyRegistration<unknown, string>

  displayTypes: DisplayType[] = []

  viewMetadata: ViewMetadata = {}

  // extendedName can be used for when you extend a given view type, and want
  // to register all of that view types displays to yourself
  //
  // e.g. you create a linear-genome-view subtype, and want all the tracks that
  // are compatible display types for the linear-genome-view to be compatible
  // with your type also (without this, display types are only registered to a
  // single view type)
  extendedName?: string

  constructor(stuff: {
    name: string
    displayName?: string
    stateModel: IAnyModelType | (() => Promise<IAnyModelType>)
    launchKeys?: LaunchKeyRegistration<unknown, string>
    extendedName?: string
    viewMetadata?: ViewMetadata
    ReactComponent: ViewComponentType
    aliases?: string[]
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.viewMetadata = stuff.viewMetadata ?? {}
    this.launchKeys = stuff.launchKeys
    this.extendedName = stuff.extendedName
  }

  /**
   * Every key this view accepts written on the view object — its declared MST
   * properties plus the launch keys above. `undefined` for a view that
   * registers none: nothing there says which of its launcher's arguments are
   * settings, so a caller must classify nothing rather than call them all typos.
   * Also `undefined` while a lazily registered state model is not loaded yet,
   * for the same reason: nothing is known, so nothing is a typo.
   *
   * This is the set `withLaunchInput`'s partition reads off the same two
   * declarations, published for the surfaces that never build a view snapshot —
   * a session spec launches straight through `LaunchView-<type>`.
   */
  get acceptedKeys() {
    const properties = this.isStateModelLoaded
      ? (this.stateModel.properties as Record<string, unknown>)
      : undefined
    return this.launchKeys && properties
      ? [
          ...Object.keys(properties),
          ...Object.keys(this.launchKeys.keys),
          ...this.launchKeys.passThrough,
        ]
      : undefined
  }

  addDisplayType(display: DisplayType) {
    this.displayTypes.push(display)
  }
}
