// vendored from quick-lru@6.1.1, didn't like being compiled as a 'pure-esm' nodejs dependency
// the license is reproduced below https://github.com/sindresorhus/quick-lru/blob/main/license
// MIT License

// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
export interface Options<KeyType, ValueType> {
  /**
	The maximum number of milliseconds an item should remain in the cache.

	@default Infinity

	By default, `maxAge` will be `Infinity`, which means that items will never expire.
	Lazy expiration upon the next write or read call.

	Individual expiration of an item can be specified by the `set(key, value, maxAge)` method.
	*/
  readonly maxAge?: number

  /**
	The maximum number of items before evicting the least recently used items.
	*/
  readonly maxSize: number

  /**
	Called right before an item is evicted from the cache.

	Useful for side effects or for items like object URLs that need explicit cleanup (`revokeObjectURL`).
	*/
  onEviction?: (key: KeyType, value: ValueType) => void
}

export default class QuickLRU<KeyType, ValueType>
  extends Map
  implements Iterable<[KeyType, ValueType]>
{
  /**
	The stored item count.
	*/
  readonly size: number

  /**
	Simple ["Least Recently Used" (LRU) cache](https://en.m.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_.28LRU.29).

	The instance is an [`Iterable`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Iteration_protocols) of `[key, value]` pairs so you can use it directly in a [`for…of`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Statements/for...of) loop.

	@example
	```
	import QuickLRU from 'quick-lru';

	const lru = new QuickLRU({maxSize: 1000});

	lru.set('🦄', '🌈');

	lru.has('🦄');
	//=> true

	lru.get('🦄');
	//=> '🌈'
	```
	*/
  constructor(options: Options<KeyType, ValueType>)

  [Symbol.iterator](): IterableIterator<[KeyType, ValueType]>

  /**
	Set an item. Returns the instance.

	Individual expiration of an item can be specified with the `maxAge` option. If not specified, the global `maxAge` value will be used in case it is specified in the constructor, otherwise the item will never expire.

	@returns The list instance.
	*/
  set(key: KeyType, value: ValueType, options?: { maxAge?: number }): this

  /**
	Get an item.

	@returns The stored item or `undefined`.
	*/
  get(key: KeyType): ValueType | undefined

  /**
	Check if an item exists.
	*/
  has(key: KeyType): boolean

  /**
	Get an item without marking it as recently used.

	@returns The stored item or `undefined`.
	*/
  peek(key: KeyType): ValueType | undefined

  /**
	Delete an item.

	@returns `true` if the item is removed or `false` if the item doesn't exist.
	*/
  delete(key: KeyType): boolean

  /**
	Delete all items.
	*/
  clear(): void

  /**
	Update the `maxSize` in-place, discarding items as necessary. Insertion order is mostly preserved, though this is not a strong guarantee.

	Useful for on-the-fly tuning of cache sizes in live systems.
	*/
  resize(maxSize: number): void

  /**
	Iterable for all the keys.
	*/
  keys(): IterableIterator<KeyType>

  /**
	Iterable for all the values.
	*/
  values(): IterableIterator<ValueType>

  /**
	Iterable for all entries, starting with the oldest (ascending in recency).
	*/
  entriesAscending(): IterableIterator<[KeyType, ValueType]>

  /**
	Iterable for all entries, starting with the newest (descending in recency).
	*/
  entriesDescending(): IterableIterator<[KeyType, ValueType]>
}
