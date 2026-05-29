import {
  getUnionSubtypes,
  isArrayType,
  isLateType,
  isMapType,
  isOptionalType,
  isUnionType,
} from '@jbrowse/mobx-state-tree'

import type {
  IAnyComplexType,
  IAnyType,
  IModelReflectionPropertiesData,
  IOptionalIType,
  ISimpleType,
  UnionStringArray,
  ValidOptionalValues,
} from '@jbrowse/mobx-state-tree'

export interface ILiteralType<T> extends ISimpleType<T> {
  value: T
}

// MST's getSubTypes() returns this sentinel string when a type can't report a
// single subtype. It isn't exported by name, so we detect it structurally: a
// real subtype is an IAnyType object, never a string or null.
function isSubType(t: unknown): t is IAnyType {
  return typeof t === 'object' && t !== null
}

/**
 * get the inner type of an MST optional, refinement, array, map, or late type
 */
export function getSubType(type: IAnyType): IAnyType {
  // optional/refinement/late report their wrapped type here; union returns an
  // array (handled by getUnionSubTypes) and array/map return null
  const sub = type.getSubTypes()
  if (isSubType(sub)) {
    return sub
  }
  if (isArrayType(type) || isMapType(type)) {
    return type.getChildType()
  }
  throw new TypeError('unsupported mst type')
}

/**
 * get the array of the subtypes in a union (drills through optional/refinement/
 * late wrappers that inherit the union flag)
 */
export { getUnionSubtypes as getUnionSubTypes }

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
  return (
    type as IOptionalIType<IAnyType, ValidOptionalValues>
  ).getDefaultInstanceOrSnapshot()
}

export type IEnumerationType<T extends string> = ISimpleType<
  UnionStringArray<T[]>
>

/** get the string values of an MST enumeration type */
export function getEnumerationValues(type: IAnyComplexType) {
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
    // the negated identity guards above narrow `maybeLate` to `never`, so route
    // it through a function arg (never is assignable to IAnyType) to read the
    // late type's resolved inner type via getSubTypes()
    return lateSubType(maybeLate) ?? maybeLate
  }
  return maybeLate
}

function lateSubType(type: IAnyType) {
  const sub = type.getSubTypes()
  return isSubType(sub) ? sub : undefined
}
