import {
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
  ISimpleType,
  UnionStringArray,
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

// getDefaultInstanceOrSnapshot() is a real public method on the optional type at
// runtime but isn't declared on the published @jbrowse/mobx-state-tree type
// interface, so it's reached through a typed accessor. A fork release that
// surfaces it on the optional type interface will let this drop to a plain call.
interface DefaultValueReflection {
  getDefaultInstanceOrSnapshot: () => { type: string }
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
 * get the array of the subtypes in a union
 */
export function getUnionSubTypes(unionType: IAnyType): IAnyType[] {
  if (!isUnionType(unionType)) {
    throw new TypeError('not an MST union type')
  }
  const t = unionType.getSubTypes()
  if (!Array.isArray(t)) {
    throw new Error('failed to extract subtypes from mst union')
  }
  return t
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
  return (type as unknown as DefaultValueReflection).getDefaultInstanceOrSnapshot()
}

export type IEnumerationType<T extends string> = ISimpleType<
  UnionStringArray<T[]>
>

/** get the string values of an MST enumeration type */
export function getEnumerationValues(type: IAnyComplexType) {
  const subtypes = getUnionSubTypes(type) as ILiteralType<string>[]
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
