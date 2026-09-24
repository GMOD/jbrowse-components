import {
  asArrayType,
  asMapType,
  getUnionSubtypes,
  isArrayType,
  isLateType,
  isOptionalType,
  isUnionType,
} from '@jbrowse/mobx-state-tree'

import type {
  IAnyType,
  IModelReflectionPropertiesData,
  IOptionalIType,
  ISimpleType,
  UnionStringArray,
} from '@jbrowse/mobx-state-tree'

export interface ILiteralType<T> extends ISimpleType<T> {
  value: T
}

// getSubTypes() answers null, or the `cannotDetermineSubtype` string, when a
// type reports no subtype; anything it does report is an object.
function isSubtype(t: unknown): t is IAnyType {
  return typeof t === 'object' && t !== null
}

/**
 * get the inner type of an MST optional, refinement, array, map, or late type
 */
export function getSubType(type: IAnyType): IAnyType {
  // optional/refinement/late report their wrapped type here; union returns an
  // array (handled by getUnionSubTypes) and array/map return null
  const sub = type.getSubTypes()
  if (isSubtype(sub)) {
    return sub
  }
  const collection = asArrayType(type) ?? asMapType(type)
  if (collection) {
    return collection.getChildType()
  }
  throw new TypeError('unsupported mst type')
}

/**
 * get the type of one of the properties of the given MST model type
 */
export function getPropertyType(
  type: IModelReflectionPropertiesData,
  propertyName: string,
) {
  return type.properties[propertyName]!
}

/**
 * get the default value out of an MST optional type
 */
export function getDefaultValue(type: IAnyType) {
  if (!isOptionalType(type)) {
    throw new TypeError('type must be an optional type')
  }
  // isOptionalType is a same-type guard, so narrow to the optional interface
  // that publishes getDefaultInstanceOrSnapshot
  return (type as IOptionalIType).getDefaultInstanceOrSnapshot()
}

export type IEnumerationType<T extends string> = ISimpleType<
  UnionStringArray<T[]>
>

/** get the string values of an MST enumeration type */
export function getEnumerationValues(type: IAnyType) {
  const subtypes = getUnionSubtypes(type) as ILiteralType<string>[]
  // the subtypes should all be literals with a value member
  return subtypes.map(t => t.value)
}

export function resolveLateType(maybeLate: IAnyType) {
  if (
    !isUnionType(maybeLate) &&
    !isArrayType(maybeLate) &&
    isLateType(maybeLate)
  ) {
    const sub = maybeLate.getSubTypes()
    return isSubtype(sub) ? sub : maybeLate
  }
  return maybeLate
}

export { getUnionSubtypes as getUnionSubTypes } from '@jbrowse/mobx-state-tree'
