import { getUnionSubtypes } from '@jbrowse/mobx-state-tree'

import type { IAnyType, ISimpleType } from '@jbrowse/mobx-state-tree'

interface ILiteralType<T> extends ISimpleType<T> {
  value: T
}

/** The string values of an MST enumeration type, in its order. */
export function getEnumerationValues(type: IAnyType) {
  return (getUnionSubtypes(type) as ILiteralType<string>[]).map(t => t.value)
}
