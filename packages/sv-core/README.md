# @jbrowse/sv-core

VCF breakend / structural-variant parsing and the shared SV launch helpers

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### breakendLocKey

A breakend locstring reduced to the form two spellings of one locus compare
equal in.

Case, because that is what the two halves of one record disagree about:
nanomonsv writes CHROM `chr3` and spells the same contig `CHR3` inside the ALT
bracket, and all 66 BND records of the COLO829 callset the cancer_sv demo serves
do it. Case is also the whole of the fallback `getCanonicalRefName` makes,
through `lowerCaseRefNameAliases`.

For grouping two ends of one junction, not for navigation: `chr10` against `10`
still needs an assembly, and the callers here — the overlay's alt matching and
its breakend bucketing — hold features and no assembly. A producer that has one
resolves properly instead, through `toCanonicalRefName`.

```js
// type signature
(locString: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### breakendTickPx

Screen-x of the far end of a breakend's direction tick at screen-x `x`.

`keepsDir` is genomic (see `breakendKeepsDirections`) and `reversed` is what
turns it into a screen direction, so both are required: a caller cannot compile
without answering the question. A reversed displayed region mirrors the axis, so
a tick that ignores it points at the side the derivative discards rather than
the side it keeps.

```js
// type signature
(x: number, keepsDir: number, reversed: boolean, lengthPx?: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### breakpointBpPerPx

bpPerPx that fits `windowSize` bp on each side of a breakpoint across the view
width. Falls back to a zoomed-in default when no window is requested.

```js
// type signature
(windowSize: number, width: number) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### breakpointSplitViewId

Stable id for the breakpoint split view a given launcher spawns, so repeated
launches from the same place reuse one view instead of stacking a new one each
time. `ownerId` is whatever the launcher is: a spreadsheet view (shared by the
sheet's row menu and the SV inspector's chord clicks, which then land in the
same view), or a variant feature widget.

Spelling it out inline is the same string until it isn't — the dialog appends
its own shape suffix to whatever it is handed, so a launcher that respells the
prefix gets a second view instead of reusing the first, and nothing reports it.

```js
// type signature
(ownerId: string, assemblyName: string) => string
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### getBreakendAssemblyRegions

Loads the assembly for a breakend feature and resolves the two regions its
endpoints span. Throws if the assembly, its regions, or either endpoint's region
cannot be found.

```js
// type signature
({ feature, session, assemblyName, }: { feature: Feature; session: AssemblyHost; assemblyName: string; }) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### getBreakendCoveringRegions

The two canonical-refName junction positions a breakend/SV feature spans,
through `junctionEnds`; a record naming no other end spans its own extent.

```js
// type signature
({ feature, assembly, }: { feature: Feature; assembly: ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<…>>; }> & ... 15 more ... & IStateTreeNode<...>; }) => { ...; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### junctionEnds

Where a paired record's junction is at each of its two ends, and which side of
it each end keeps — the one answer every launcher, the row menu and the chain
walk take, whether the record is a VCF breakend, a symbolic SV or a paired
adapter's row (BEDPE, STAR-Fusion). Refnames are as the record spells them.
`undefined` for a record naming no other end.

A VCF end is its own position. A paired adapter's end is a block, and the
junction is the block's edge on the side the end keeps: stated by
`mateDirection` where the adapter knows it, read off a BEDPE strand otherwise,
and with neither the two blocks face each other.

```js
// type signature
(feature: Feature) => { own: JunctionEnd; mate: JunctionEnd; } | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### linearGenomeViewOf

A feature widget's view when a launch can copy its tracks: a linear genome view,
never a circle, whose tracks carry displays a linear panel cannot draw.

```js
// type signature
(view?: { type: string; } | undefined) => (ModelInstanceTypeProps<_OverrideProps<…>> & ... 26 more ... & IStateTreeNode<...>) | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### makeFeaturePair

Both ends of a paired record, off whichever of the two things a producer states
the far one with: the `mate` field a paired adapter fills in, or a VCF `ALT`
this parses. `paired` is false for a record that names no other end, and `k2` is
then a placeholder no view resolves.

One resolver where there were three — the arc display's endpoint pair,
`svMateLocus`'s far end for a chain walk, and `pairedEndsLocString`'s two
windows for the row menu. Each spelled the 1-based-to-interbase shift itself
(`parseSvAlt` reports VCF's 1-based position while `mate.start` is already
0-based) and two of them read `ALT` ahead of `mate` while the third read `mate`
first.

```js
// type signature
(feature: Feature, alt?: string | undefined) => { k1: { refName: string; start: number; end: number; mateDirection: number; }; k2: FeatureEnd; paired: boolean; }
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### navToLoc

Navigate a feature widget's view to `locString`. A view that cannot navigate to
a locus, such as the circular view, opens the locus in a linear genome view of
its first assembly with the widget's track.

```js
// type signature
(locString: string, model: IAnyStateTreeNode, grow?: number | undefined) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### pairedEndsLocString

Both ends of a paired record as one loc string an LGV opens side by side,
`windowBp` either side of each junction. Each panel is turned so the sequence
its end keeps reads left to right into the join. Two ends of one contig closer
than a window collapse to the single span between them. `undefined` for a record
with one end.

```js
// type signature
(feature: Feature, windowBp: number) => string | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### panelIsTurned

Whether the panel showing an end has to be turned for the join to read left to
right across the seam: an end keeping the sequence to its RIGHT is reversed on
the left panel, one keeping its LEFT is reversed on the right.

```js
// type signature
(keeps: number, side: "left" | "right") => boolean
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### splitRegionAtPosition

Splits a region at `pos` into two halves that both include `pos`, so a breakend
there stays visible in each.

```js
// type signature
<…>(region: T, pos: number, assemblyName?: string | undefined) => [T & { assemblyName?: string | undefined; }, T & { ...; }]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

### svMateLocus

Where a record's other end is, in the feature's own refName namespace and
0-based like every other coordinate on a feature.

`undefined` when the record names no other end, which is most of a VCF: a plain
SNV, or an indel that is only ever its own span.

```js
// type signature
(feature: Feature) => { refName: string; pos: number; } | undefined
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/sv-core/src/util.ts)

<!-- API_DOCS_END -->
