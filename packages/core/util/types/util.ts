/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { IAnyModelType, Instance } from 'mobx-state-tree'
import PluginManager from '../../PluginManager'

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

/** get the type that a predicate asserts */
export type TypeTestedByPredicate<PREDICATE extends (thing: any) => boolean> =
  PREDICATE extends (thing: any) => thing is infer TYPE ? TYPE : never

/** get the type for an instance of an MST model in a PM factory function */
export type InstanceOfModelReturnedBy<
  FACTORY extends (pm: PluginManager) => IAnyModelType,
> = Instance<ReturnType<FACTORY>>
