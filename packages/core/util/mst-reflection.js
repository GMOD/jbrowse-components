/* eslint-disable no-underscore-dangle */
import {
  isOptionalType,
  isUnionType,
  isArrayType,
  isMapType,
  isLateType,
  IModelType,
} from 'mobx-state-tree'

/**
 * get the inner type of an MST optional, array, or late type object
 *
 * @param {IModelType} type
 * @returns {IModelType}
 */
export function getSubType(type) {
  let t
  if (isOptionalType(type)) {
    t = type._subtype || type.type
  } else if (isArrayType(type) || isMapType(type)) {
    t = type._subtype || type._subType || type.subType
  } else if (typeof type.getSubType === 'function') {
    return type.getSubType()
  } else {
    throw new TypeError('unsupported mst type')
  }
  if (!t) {
    // debugger
    throw new Error('failed to get subtype')
  }
  return t
}

/**
 * get the array of
 * @param {MST Union Type obj} unionType
 * @returns {Array<IModelType>}
 */
export function getUnionSubTypes(unionType) {
  if (!isUnionType(unionType)) throw new TypeError('not an MST union type')
  const t = unionType._types || unionType.types
  if (!t) {
    // debugger
    throw new Error('failed to extract subtypes from mst union')
  }
  return t
}

/**
 * get the type of one of the properties of the given MST model type
 *
 * @param {IModelType} type
 * @param {string} propertyName
 * @returns {IModelType}
 */
export function getPropertyType(type, propertyName) {
  const propertyType = type.properties[propertyName]
  return propertyType
}

/**
 * get the base type from inside an MST optional type
 * @param {*} type
 */
export function getDefaultValue(type) {
  if (!isOptionalType(type)) {
    throw new TypeError('type must be an optional type')
  }
  return type._defaultValue || type.defaultValue
}

/** get the string values of an MST enumeration type */
export function getEnumerationValues(type) {
  const subtypes = getUnionSubTypes(type)
  // the subtypes should all be literals with a value member
  return subtypes.map(t => t.value)
}

export function resolveLateType(maybeLate) {
  if (
    !isUnionType(maybeLate) &&
    !isArrayType(maybeLate) &&
    isLateType(maybeLate)
  ) {
    return maybeLate.getSubType()
  }
  return maybeLate
}
