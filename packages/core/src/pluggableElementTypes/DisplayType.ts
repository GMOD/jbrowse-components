import LazyStateModelElement from './LazyStateModelElement.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyReactComponentType } from '../util/index.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

export type DisplayEntry = Record<string, unknown>

/**
 * A display type retired into this one. Configs and sessions naming it load
 * as this display, the entry rewritten by `migrate` first: the settings the
 * old type's picture needs, and its own spelling of any slot value.
 */
export interface RetiredDisplayType {
  type: string
  migrate?: (entry: DisplayEntry) => DisplayEntry
}

/**
 * Display-instance props an old session carries that are config slots now.
 * `lift` answers the slots they become, which the session migration writes
 * into the track's config; `keys` lists them, so the instance sheds them and
 * `jbrowse validate` reports them as stale rather than dead.
 */
export interface RetiredDisplayState {
  keys: readonly string[]
  lift: (instance: DisplayEntry) => DisplayEntry
}

export default class DisplayType extends LazyStateModelElement {
  protected readonly group = 'display'

  configSchema: AnyConfigurationSchemaType

  ReactComponent: AnyReactComponentType

  /**
   * The track type the display attaches to, or several: a display that reads
   * a field any feature adapter serves (the Manhattan plot's `score`) belongs
   * to every track type whose adapters serve it.
   */
  trackType: string | string[]

  /**
   * The view type the display is associated with
   */
  viewType: string

  /**
   * Help text describing the display type
   */
  helpText?: string

  retiredTypes: readonly RetiredDisplayType[]

  /**
   * Rewrites a config entry of this display whose slot values an older
   * release spelt differently. Runs on every entry, before the display union
   * reads it, so it must leave a current entry as it found it.
   */
  retiredConfig?: (entry: DisplayEntry) => DisplayEntry

  retiredState?: RetiredDisplayState

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType | (() => Promise<IAnyModelType>)
    trackType: string | string[]
    viewType: string
    displayName?: string
    configSchema: AnyConfigurationSchemaType
    ReactComponent: AnyReactComponentType
    helpText?: string
    retiredTypes?: readonly RetiredDisplayType[]
    retiredConfig?: (entry: DisplayEntry) => DisplayEntry
    retiredState?: RetiredDisplayState
  }) {
    super({
      ...stuff,
      aliases: stuff.retiredTypes?.map(r => r.type),
    })
    this.configSchema = stuff.configSchema
    this.ReactComponent = stuff.ReactComponent
    this.trackType = stuff.trackType
    this.viewType = stuff.viewType
    this.helpText = stuff.helpText
    this.retiredTypes = stuff.retiredTypes ?? []
    this.retiredConfig = stuff.retiredConfig
    this.retiredState = stuff.retiredState
  }
}
