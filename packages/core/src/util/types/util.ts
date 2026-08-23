import type PluginManager from '../../PluginManager.ts'
import type React from 'react'

export type { TypeTestedByPredicate } from './predicate.ts'

/**
 * Obtain the return type of a constructor function type.
 * Differs from core Typescript InstanceType in that it returns never if not matched.
 */
export type InstanceTypeRestrictive<
  CONSTRUCTOR extends new (...args: any[]) => any,
> = CONSTRUCTOR extends new (...args: any[]) => infer CLASS ? CLASS : never

/** extracts the class type from a factory function that returns a constructor */
export type ClassReturnedBy<FACT extends (pm: PluginManager) => any> =
  InstanceTypeRestrictive<ReturnType<FACT>>

/** A react component with any props. Consider using something more specific if possible */
export type AnyReactComponentType = React.ComponentType<any>
