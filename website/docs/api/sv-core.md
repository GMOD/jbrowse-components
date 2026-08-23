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

## breakpointSplitViewId

Stable id for the breakpoint split view a given launcher spawns, so repeated
launches from the same place reuse one view instead of stacking a new one each
time. `ownerId` is whatever the launcher is: a spreadsheet view (shared by the
sheet's row menu and the SV inspector's chord clicks, which then land in the
same view), or a variant feature widget.

Spelling it out inline is the same string until it isn't — the dialog appends
its own shape suffix to whatever it is handed, so a launcher that respells the
prefix quietly gets a second view rather than a broken one.

```js
// type signature
(ownerId: string, assemblyName: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

## getBreakendAssemblyRegions

Loads the assembly for a breakend feature and resolves the two regions its
endpoints span. Throws if the assembly, its regions, or either endpoint's region
cannot be found.

```js
// type signature
({ feature, session, assemblyName, }: { feature: Feature; session: AssemblyHost; assemblyName: string; }) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

## getBreakendCoveringRegions

Resolves the two canonical-refName endpoints a breakend/SV feature spans.

```js
// type signature
({ feature, assembly, }: { feature: Feature; assembly: ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<…>>; }> & ... 14 more ... & IStateTreeNode<...>; }) => { ...; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

## getBreakendMateLocString

The mate locString ("chr2:100") of a parsed breakend, or undefined when it names
no navigable position. Two ALT forms reach here without one: a single breakend
(`.A` / `G.`) has no mate at all, and the symbolic-mate forms (`G<DEL>`,
`<DEL>G`) get a placeholder `<DEL>:1` from parseBreakend, which puts a symbolic
allele id where a contig name belongs. Callers that navigate or split-view a
mate must drop both rather than treat `<DEL>` as a refName.

```js
// type signature
(breakend?: Breakend | undefined) => string | undefined
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

## safeParseBreakend

parseBreakend, honoring its `Breakend | undefined` signature. ALT strings are
user data and malformed breakends do occur;

```js
// type signature
(alt: string) => Breakend | undefined
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

## svMateLocus

Where a record's other end is, in the feature's own refName namespace and
0-based like every other coordinate on a feature.

The places that need it were each resolving it themselves — `parseSvAlt` first,
for a breakend or a symbolic allele carrying CHR2/END, then an explicit `mate`
field for a BEDPE row — and each had its own off-by-one to get wrong, since
`parseSvAlt` reports VCF's 1-based position while `mate.start` is already
0-based.

`undefined` when the record names no other end, which is most of a VCF: a plain
SNV, or an indel that is only ever its own span.

```js
// type signature
(feature: Feature) => { refName: string; pos: number; } | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)
