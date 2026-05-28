# shared (MultiSampleVariant)

## Hot rendering loops are pure for-loops — no array-prototype iteration

The per-feature × per-sample loops in `MultiVariantDisplay` and
`MultiVariantMatrixDisplay` execute on the order of `numFeatures * numSamples`
times per cellData computation — easily 10⁸+ iterations on a real multisample
VCF. Inside those loops:

- Use indexed `for (let i = 0; i < arr.length; i++)` — not `.forEach` / `.map` /
  `.find` / `.filter`. The Array-prototype callbacks allocate a closure per
  invocation and inhibit inlining.
- Don't iterate via `Object.values` / `Object.entries` / `Object.keys` over
  large `Record<...>` shapes — they materialize a temporary array. Use
  `for (const key in obj)` instead.
- Avoid `??`/`||` fallbacks that wrap large objects (cheap on scalars, but
  triggers de-opt patterns when the right side is allocating).

This applies specifically to:

- `computeVariantCells.ts` (per-feature loop, lines ~168+, each iterating
  per-sample at ~256-308-362-434)
- `computeVariantMatrixCells.ts` (matrix equivalent)
- Anything called from `attachBackend`'s `upload`/`render` callback bodies _that
  touches per-cell data_

## What is NOT in scope

- `perRegionCellData` iteration: a typical view shows 1-3 regions.
  `Object.entries` there is fine; the allocation is dwarfed by the work inside.
- One-shot actions (sort-by-genotype, hover lookup): runs once per user click.
  Normal `.find` is fine.
- UI code (dialogs, settings panels, SVG overlays).
- VCF parse paths, RPC argument shaping: amortized across the whole fetch.

The discipline above is only for the _huge_ loops. Don't apply it everywhere —
the codebase as a whole prefers declarative iteration.

## RPC ↔ model boundary: genotype maps must be keyed by `sampleName`

`ProcessedSource` has two name fields:

- **`name`** — display/rendering identity. In phased mode this is HP-suffixed:
  `"HG001 HP0"`, `"HG001 HP1"`. Used for `sourceNameList`, `sourceMap` keys, and
  row-index lookups inside the canvas renderer.
- **`sampleName`** — VCF sample identity. Always the bare sample name `"HG001"`.
  Used to look up genotype data in the VCF feature object.

Any `Record<string, string>` that maps a sample to a genotype string and crosses
(or is consumed by) the RPC → state-model boundary **must be keyed by
`sampleName`**. Keying by `name` silently breaks in phased mode because the
consumer (`sortSourcesByGenotype`, hover lookup) does not know the HP suffix.

Concretely:

- `featureGenotypeMap[id].genotypes` in `computeVariantCells.ts` and
  `computeVariantMatrixCells.ts` → keyed by `sampleName`.
- Hover lookup in `VariantComponent.tsx` → resolve `source.sampleName` from
  `sourceMap` before indexing into `genotypes`.
- `sortSourcesByGenotype` → already uses `a.sampleName` as the lookup key; don't
  change it to `a.name`.
