import { isOptionalType, isUnionType, isArrayType , isMapType } from 'mobx-state-tree'


/**
 * get the inner type of an MST optional or array type object
 *
 * @param {IModelType} type
 * @returns {IModelType}
 */
export function getSubType(type) {
  let t
  if (isOptionalType(type)) {
    // eslint-disable-next-line no-underscore-dangle
    t = type._subtype || type.type
  } else if (isArrayType(type) || isMapType(type)) {
    t = type._subtype || type._subType || type.subType
  } else {
    throw new TypeError('unsupported mst type')
  }
  if (!t) {
    debugger
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
  // eslint-disable-next-line no-underscore-dangle
  const t = unionType._types || unionType.types
  if (!t) {
    debugger
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


export function getDefaultValue(type) {
  if (!isOptionalType(type)) throw new TypeError('type must be an optional type')
  // eslint-disable-next-line no-underscore-dangle
  return type._defaultValue || type.defaultValue
}
