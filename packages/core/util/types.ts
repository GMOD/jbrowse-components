import PluginManager from '../PluginManager'

/** extracts the class type that is returned by a constructor type */
export type ConstructorClass<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CONSTRUCTOR extends new (...args: any[]) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = CONSTRUCTOR extends new (...args: any[]) => infer CLASS ? CLASS : never

/** extracts the class type from a factory function that returns a constructor */
export type ClassReturnedBy<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FACT extends (pm: PluginManager) => any
> = ConstructorClass<ReturnType<FACT>>

/** A react component with any props. Consider using something more specific if possible */
export type AnyReactComponentType = React.ComponentType<Record<string, unknown>>
