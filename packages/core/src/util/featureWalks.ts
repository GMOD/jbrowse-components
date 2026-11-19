import type { Feature } from './simpleFeature.ts'

function inheritedValue(feature: Feature, name: string) {
  let cur: Feature | undefined = feature
  let value: unknown
  while (cur !== undefined && value === undefined) {
    value = cur.get(name)
    cur = cur.parent?.()
  }
  return value
}

function onlyChild(feature: Feature) {
  const children = feature.get('subfeatures')
  return children?.length === 1 ? children[0] : undefined
}

function unbranchedValue(feature: Feature, name: string) {
  let cur: Feature | undefined = feature
  let value: unknown
  while (cur !== undefined && value === undefined) {
    value = cur.get(name)
    cur = onlyChild(cur)
  }
  return value
}

/**
 * The jexl functions that read one attribute from a feature or its relatives,
 * `getInherited(feature, 'x')` and `getUnbranched(feature, 'x')`. Both jexl and
 * `fieldReader`'s native `||` chain call these, so a default field written
 * with one reads the same either way.
 */
export const featureWalks = {
  getInherited: inheritedValue,
  getUnbranched: unbranchedValue,
}

export function isFeatureWalk(name: string): name is keyof typeof featureWalks {
  return Object.hasOwn(featureWalks, name)
}
