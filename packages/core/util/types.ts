/* eslint-disable @typescript-eslint/no-explicit-any */
import PluginManager from '../PluginManager'

/** extracts the class type that is returned by a constructor type */
export type ConstructorClass<
  CONSTRUCTOR extends new (...args: any[]) => any
> = CONSTRUCTOR extends new (...args: any[]) => infer CLASS ? CLASS : never

/** extracts the class type from a factory function that returns a constructor */
export type ClassReturnedBy<
  FACT extends (pm: PluginManager) => any
> = ConstructorClass<ReturnType<FACT>>

/** A react component with any props. Consider using something more specific if possible */
export type AnyReactComponentType = React.ComponentType<Record<string, unknown>>

/** get the type that a predicate asserts */
export type TypeTestedByPredicate<
  PREDICATE extends (thing: any) => boolean
> = PREDICATE extends (thing: any) => thing is infer TYPE ? TYPE : never
