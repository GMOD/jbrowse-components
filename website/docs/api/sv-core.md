---
id: sv-core
title: sv-core
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## breakpointBpPerPx

bpPerPx that fits `windowSize` bp on each side of a breakpoint across the view
width. Falls back to a zoomed-in default when no window is requested.

```js
// type signature
(windowSize: number, width: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

## getBreakendAssemblyRegions

Loads the assembly for a breakend feature and resolves the two regions its
endpoints span. Throws if the assembly, its regions, or either endpoint's region
cannot be found.

```js
// type signature
({ feature, session, assemblyName, }: { feature: Feature; session: AbstractSessionModel; assemblyName: string; }) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

## getBreakendCoveringRegions

Resolves the two canonical-refName endpoints a breakend/SV feature spans.

```js
// type signature
({ feature, assembly, }: { feature: Feature; assembly: ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<…>>; }> & ... 13 more ... & IStateTreeNode<...>; }) => { ...; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

## parseSvAlt

Parse raw (non-assembly-resolved) mate coordinates from a VCF SV feature+alt.
Returns undefined when no mate coordinate info is found.

```js
// type signature
(feature: Feature, alt?: string | undefined) => { mateRefName: string; matePos: number; mateDirection?: number | undefined; joinDirection?: number | undefined; } | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

## splitRegionAtPosition

Splits a region at `pos` into two halves that both include `pos`, so a breakend
there stays visible in each.

```js
// type signature
<…>(region: T, pos: number, assemblyName?: string | undefined) => [T & { assemblyName?: string | undefined; }, T & { ...; }]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)
