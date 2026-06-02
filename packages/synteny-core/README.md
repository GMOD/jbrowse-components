# @jbrowse/synteny-core

Shared utilities for synteny and dotplot rendering

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### applyAlpha

Applies an alpha to a CSS color, returning the original when `a === 1`.

```js
// type signature
(color: string, a: number) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

### getQueryColor

Stable category10 color for a query name, via `hashString`.

```js
// type signature
(queryName: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

### hashString

Deterministic non-negative 32-bit hash of a string.

```js
// type signature
(str: string) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/colorUtils.ts)

<!-- API_DOCS_END -->
