import {
  isOptionalType,
  isUnionType,
  isArrayType,
  isMapType,
  isLateType,
} from 'mobx-state-tree'
import type {
  IAnyType,
  IModelReflectionPropertiesData,
  IAnyComplexType,
  ISimpleType,
  UnionStringArray,
} from 'mobx-state-tree'

export interface ILiteralType<T> extends ISimpleType<T> {
  value: T
}

/**
 * get the inner type of an MST optional, array, or late type object
 */
export function getSubType(type: IAnyType): IAnyType {
  let t: IAnyType
  if (isOptionalType(type)) {
    // @ts-expect-error
    t = type._subtype || type.type
  } else if (isArrayType(type) || isMapType(type)) {
    // @ts-expect-error
    t = type._subtype || type._subType || type.subType
    // @ts-expect-error
  } else if (typeof type.getSubType === 'function') {
    // @ts-expect-error
    return type.getSubType()
  } else {
    throw new TypeError('unsupported mst type')
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!t) {
    throw new Error('failed to get subtype')
  }
  return t
}

/**
 * get the array of the subtypes in a union
 */
export function getUnionSubTypes(unionType: IAnyType): IAnyType[] {
  if (!isUnionType(unionType)) {
    throw new TypeError('not an MST union type')
  }
  const t =
    // @ts-expect-error
    unionType._types ||
    // @ts-expect-error
    unionType.types ||
    // @ts-expect-error
    getSubType(unionType)._types ||
    // @ts-expect-error
    getSubType(unionType).types
  if (!t) {
    // debugger
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
 * get the base type from inside an MST optional type
 */
export function getDefaultValue(type: IAnyType) {
  if (!isOptionalType(type)) {
    throw new TypeError('type must be an optional type')
  }
  // @ts-expect-error
  return type._defaultValue || type.defaultValue
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
    // @ts-expect-error
    return maybeLate.getSubType()
  }
  return maybeLate
}
