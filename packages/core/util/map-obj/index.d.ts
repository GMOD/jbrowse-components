/**
Return this value from a `mapper` function to remove a key from an object.

@example
```
import mapObject, {mapObjectSkip} from 'map-obj';

const object = {one: 1, two: 2};
const mapper = (key, value) => value === 1 ? [key, value] : mapObjectSkip;
const result = mapObject(object, mapper);

console.log(result);
//=> {one: 1}
```
*/
export const mapObjectSkip: unique symbol

/**
Mapper function for transforming object keys and values.
*/
export type Mapper<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
> = (
  sourceKey: Extract<keyof SourceObjectType, string>,
  sourceValue: SourceObjectType[keyof SourceObjectType],
  source: SourceObjectType,
) =>
  | [
      targetKey: MappedObjectKeyType,
      targetValue: MappedObjectValueType,
      mapperOptions?: MapperOptions,
    ]
  | typeof mapObjectSkip

/**
Mapper function when `includeSymbols: true` is enabled.
*/
export type MapperWithSymbols<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
> = (
  sourceKey: keyof SourceObjectType,
  sourceValue: SourceObjectType[keyof SourceObjectType],
  source: SourceObjectType,
) =>
  | [
      targetKey: MappedObjectKeyType,
      targetValue: MappedObjectValueType,
      mapperOptions?: MapperOptions,
    ]
  | typeof mapObjectSkip

/**
Mapper used when `{deep: true}` is enabled.

In deep mode we may visit nested objects with keys and values unrelated to the top-level object, so we intentionally widen the key and value types.
*/
type DeepMapper<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
> = (
  sourceKey: string,
  sourceValue: unknown,
  source: SourceObjectType,
) =>
  | [
      targetKey: MappedObjectKeyType,
      targetValue: MappedObjectValueType,
      mapperOptions?: MapperOptions,
    ]
  | typeof mapObjectSkip

/**
Deep mapper when `includeSymbols: true` is enabled.
*/
type DeepMapperWithSymbols<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
> = (
  sourceKey: string | symbol,
  sourceValue: unknown,
  source: SourceObjectType,
) =>
  | [
      targetKey: MappedObjectKeyType,
      targetValue: MappedObjectValueType,
      mapperOptions?: MapperOptions,
    ]
  | typeof mapObjectSkip

export interface Options {
  /**
	Recurse nested objects and objects in arrays.

	@default false

	Built-in objects like `RegExp`, `Error`, `Date`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Promise`, `ArrayBuffer`, `DataView`, typed arrays (Uint8Array, etc.), and `Blob` are not recursed into. Special objects like Jest matchers are also automatically excluded.
	*/
  readonly deep?: boolean

  /**
	Include symbol keys in the iteration.

	By default, symbol keys are completely ignored and not passed to the mapper function. When enabled, the mapper will also be called with symbol keys from the source object, allowing them to be transformed or included in the result. Only enumerable symbol properties are included.

	@default false
	*/
  readonly includeSymbols?: boolean

  /**
	The target object to map properties onto.

	@default {}
	*/
  readonly target?: Record<string | symbol, unknown>
}

export type DeepOptions = {
  readonly deep: true
} & Options

export type TargetOptions<
  TargetObjectType extends Record<string | symbol, unknown>,
> = {
  readonly target: TargetObjectType
} & Options

export type SymbolOptions = {
  readonly includeSymbols: true
} & Options

export interface MapperOptions {
  /**
	Whether to recurse into `targetValue`.

	Requires `deep: true`.

	@default true
	*/
  readonly shouldRecurse?: boolean
}

/**
Map object keys and values into a new object.

@param source - The source object to copy properties from.
@param mapper - A mapping function.

@example
```
import mapObject, {mapObjectSkip} from 'map-obj';

// Swap keys and values
const newObject = mapObject({foo: 'bar'}, (key, value) => [value, key]);
//=> {bar: 'foo'}

// Convert keys to lowercase (shallow)
const newObject = mapObject({FOO: true, bAr: {bAz: true}}, (key, value) => [key.toLowerCase(), value]);
//=> {foo: true, bar: {bAz: true}}

// Convert keys to lowercase (deep recursion)
const newObject = mapObject({FOO: true, bAr: {bAz: true}}, (key, value) => [key.toLowerCase(), value], {deep: true});
//=> {foo: true, bar: {baz: true}}

// Filter out specific values
const newObject = mapObject({one: 1, two: 2}, (key, value) => value === 1 ? [key, value] : mapObjectSkip);
//=> {one: 1}

// Include symbol keys
const symbol = Symbol('foo');
const newObject = mapObject({bar: 'baz', [symbol]: 'qux'}, (key, value) => [key, value], {includeSymbols: true});
//=> {bar: 'baz', [Symbol(foo)]: 'qux'}
```
*/
// Overloads with includeSymbols: true
export default function mapObject<
  SourceObjectType extends Record<string | symbol, unknown>,
  TargetObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  source: SourceObjectType,
  mapper: DeepMapperWithSymbols<
    SourceObjectType,
    MappedObjectKeyType,
    MappedObjectValueType
  >,
  options: DeepOptions & SymbolOptions & TargetOptions<TargetObjectType>,
): TargetObjectType & Record<string | symbol, unknown>
export default function mapObject<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  source: SourceObjectType,
  mapper: DeepMapperWithSymbols<
    SourceObjectType,
    MappedObjectKeyType,
    MappedObjectValueType
  >,
  options: DeepOptions & SymbolOptions,
): Record<string | symbol, unknown>
export default function mapObject<
  SourceObjectType extends Record<string | symbol, unknown>,
  TargetObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  source: SourceObjectType,
  mapper: MapperWithSymbols<
    SourceObjectType,
    MappedObjectKeyType,
    MappedObjectValueType
  >,
  options: SymbolOptions & TargetOptions<TargetObjectType>,
): TargetObjectType & Record<MappedObjectKeyType, MappedObjectValueType>
export default function mapObject<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  source: SourceObjectType,
  mapper: MapperWithSymbols<
    SourceObjectType,
    MappedObjectKeyType,
    MappedObjectValueType
  >,
  options: SymbolOptions,
): Record<MappedObjectKeyType, MappedObjectValueType>
// Overloads without includeSymbols (default)
export default function mapObject<
  SourceObjectType extends Record<string | symbol, unknown>,
  TargetObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  source: SourceObjectType,
  mapper: DeepMapper<
    SourceObjectType,
    MappedObjectKeyType,
    MappedObjectValueType
  >,
  options: DeepOptions & TargetOptions<TargetObjectType>,
): TargetObjectType & Record<string | symbol, unknown>
export default function mapObject<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  source: SourceObjectType,
  mapper: DeepMapper<
    SourceObjectType,
    MappedObjectKeyType,
    MappedObjectValueType
  >,
  options: DeepOptions,
): Record<string | symbol, unknown>
export default function mapObject<
  SourceObjectType extends Record<string | symbol, unknown>,
  TargetObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  source: SourceObjectType,
  mapper: Mapper<SourceObjectType, MappedObjectKeyType, MappedObjectValueType>,
  options: TargetOptions<TargetObjectType>,
): TargetObjectType & Record<MappedObjectKeyType, MappedObjectValueType>
export default function mapObject<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  source: SourceObjectType,
  mapper: Mapper<SourceObjectType, MappedObjectKeyType, MappedObjectValueType>,
  options?: Options,
): Record<MappedObjectKeyType, MappedObjectValueType>
