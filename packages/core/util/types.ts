/* eslint-disable @typescript-eslint/no-explicit-any */
import { isStateTreeNode } from 'mobx-state-tree'
import PluginManager from '../PluginManager'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

/**
 * Obtain the return type of a constructor function type.
 * Differs from core Typescript InstanceType in that it returns never if not matched.
 */
export type InstanceTypeRestrictive<
  CONSTRUCTOR extends new (...args: any[]) => any
> = CONSTRUCTOR extends new (...args: any[]) => infer CLASS ? CLASS : never

/** extracts the class type from a factory function that returns a constructor */
export type ClassReturnedBy<
  FACT extends (pm: PluginManager) => any
> = InstanceTypeRestrictive<ReturnType<FACT>>

/** A react component with any props. Consider using something more specific if possible */
export type AnyReactComponentType = React.ComponentType<Record<string, unknown>>

/** get the type that a predicate asserts */
export type TypeTestedByPredicate<
  PREDICATE extends (thing: any) => boolean
> = PREDICATE extends (thing: any) => thing is infer TYPE ? TYPE : never

export interface AbstractViewContainer {
  removeView(view: AbstractViewModel): void
}
export function isViewContainer(
  thing: unknown,
): thing is AbstractViewContainer {
  return isStateTreeNode(thing) && 'removeView' in thing
}

/** minimum interface that all session state models must implement */
export interface AbstractSessionModel extends AbstractViewContainer {
  editConfiguration(configuration: AnyConfigurationModel): void
  clearSelection(): void
  configuration: AnyConfigurationModel
  pluginManager: PluginManager
  rpcManager: any
  assemblyNames: string[]
  assemblies: AnyConfigurationModel[]
  visibleDrawerWidget?: { id: string }
  addDrawerWidget(
    typeName: string,
    id: string,
    initialState: Record<string, unknown>,
    configuration?: { type: string },
  ): void
  showDrawerWidget(drawerWidget: unknown): void
}
export function isSessionModel(thing: unknown): thing is AbstractSessionModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'pluginManager' in thing &&
    'configuration' in thing
  )
}

/** minimum interface that all view state models must implement */
export interface AbstractViewModel {
  id: string
  showTrack(configuration: AnyConfigurationModel): void
  hideTrack(configuration: AnyConfigurationModel): void
}
export function isViewModel(thing: unknown): thing is AbstractViewModel {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'showTrack' in thing &&
    'hideTrack' in thing
  )
}
