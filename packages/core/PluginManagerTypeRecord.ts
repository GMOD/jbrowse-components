/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type PluggableElementBase from './pluggableElementTypes/PluggableElementBase'

/** internal class that holds the info for a certain element type */
export default class PluginManagerTypeRecord<
  ElementClass extends PluggableElementBase,
> {
  registeredTypes: Record<string, ElementClass> = {}

  constructor(
    public typeName: string,
    public baseClass:
      | (new (...args: unknown[]) => ElementClass)
      // covers abstract class case
      | (Function & {
          prototype: ElementClass
        }),
  ) {}

  add(name: string, t: ElementClass) {
    this.registeredTypes[name] = t
  }

  has(name: string) {
    return name in this.registeredTypes
  }

  get(name: string) {
    if (!this.has(name)) {
      throw new Error(
        `${this.typeName} '${name}' not found, perhaps its plugin is not loaded or its plugin has not added it.`,
      )
    }
    return this.registeredTypes[name]
  }

  all() {
    return Object.values(this.registeredTypes)
  }
}
