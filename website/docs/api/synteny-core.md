---
id: synteny-core
title: synteny-core
---

Note: this document is automatically generated from exported functions marked
with an `#api` JSDoc tag in our source code. See
[Plugin dependencies and re-exports](/docs/developer_guides/imports_and_reexports)
for how to import these from a plugin.

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
