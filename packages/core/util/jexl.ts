import jexl from 'jexl'
import { Feature } from './simpleFeature'

// below are core functions
jexl.addFunction('getFeatureData', (feature: Feature, data: string) => {
  return feature.get(data)
})

jexl.addFunction('getFeatureId', (feature: Feature) => {
  return feature.id()
})

// let user cast a jexl type into a javascript type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
jexl.addFunction('cast', (arg: any) => {
  return arg
})

// math
jexl.addFunction('max', Math.max)
jexl.addFunction('min', Math.min)
jexl.addFunction('sqrt', Math.sqrt)

// eslint-disable-next-line no-bitwise
jexl.addBinaryOp('&', 15, (a: number, b: number) => a & b)

function createJexlInstance(/* config?: any*/) {
  // someday will make sure all of configs callbacks are added in, including ones passed in
  return jexl
}

export default createJexlInstance
