---
name: ld-color-object
description: "Colin's 2026-10-04 call: the LD display's metric becomes color.field ('r2' | 'dprime') on a colour object composed from display-kit's kit in the Hi-C mould, with presets keeping reds and blues as defaults, any named scheme allowed, pinned domain ends reaching the shader, and ldMetric (a v4 slot) lifted by retired. The order of work and the surfaces that follow."
---

# The LD display's colour object

Colin settled this on 2026-10-04. Template: today's Hi-C conversion
(`plugins/hic/src/LinearHicDisplay/hicColorConfigSchema.ts`, `model.ts`'s
`colorEncoding`, `notices`, the menu writing the object). The cell value is
the statistic, so the colour's `field` is the metric; keeping `ldMetric` would
leave two slots for one concept or the r2-reds/dprime-blues rule as display
code the validator cannot see. Delete this file when it lands.

## Facts that shape it

- LD's ramps are already byte-identical to core's `reds` and `blues`:
  `generateLDColorRamp` returns `rampLutOf({ scheme })` and a probe matched
  `continuousColorScale` over 10,001 values with 0 mismatches. No new scheme.
- `ldMetric` shipped from v4.1.1 to v4.3.0 (`SharedLDConfigSchema.ts` at
  v4.3.0), so it earns `retired: { ldMetric: field => ({ color: { field } }) }`.
  The v4 `colorScheme` string was never a named scheme and gets no lift.
- The served metric can differ from the written one: the worker downgrades a
  missing column (`VariantRPC/getLDMatrixFromPlink.ts` `resolveMetric`) and
  echoes `rpcData.metric`; `effectiveLdMetric` prefers it, and so must the
  encoding, so a downgraded file and a stale triangle keep today's hue.
- The shader samples the LUT at the raw value with no domain uniform
  (`shaders/ldUniforms.slang`, `ldRampColor`); `drawLDBlocks.ts` is the
  Canvas2D twin.

## Order of work

1. **Schema** `plugins/variants/src/LDDisplay/ldColorConfigSchema.ts`
   (`LDColor`, closed): `colorChannelSlots({ scales: ['linear'], fieldType: 'string', fieldDefault: 'r2' })`
   with `field` a stringEnum of `r2 | dprime`, `scheme` maybe-enum,
   `reverse` maybe-boolean (unset follows `darkAtLowEnd`, as Hi-C: lift that
   rule into one display-kit helper both read), `colorDomainEndsSlots`, no
   `domainQuantile` (r² keeps its absolute 0..1 meaning). Presets
   `LD_FIELD_PRESETS = { r2: { scale: 'linear', scheme: 'reds', title: 'R²' }, dprime: { scale: 'linear', scheme: 'blues', title: "D'" } }`
   through `fieldPresets`. `configSchemaLDTrack.ts` declares `color` and the
   `ldMetric` lift.
2. **Model** (`model.ts`): `colorField` reads `color.field` and feeds
   `rpcProps.ldMetric` (the RPC arg keeps its worker name); `colorEncoding`
   is `colorEncodingOf({ ...colorSettingOf(conf.color), field: rpcData?.metric ?? colorField }, LD_FIELD_PRESETS)`;
   `colorScheme`/`colorReverse` read it; `colorRamp` depends on those two
   primitives only (the LUT is identity-cached, so a domain or legend edit
   uploads no texture); `colorDomain = rampDomain(domainMin, domainMax, [0, 1])`;
   `renderState` carries `colorRamp` and `colorDomain`, and `ldMarks.ts`'s
   `textures`/`params` read the state, not the payload, which also removes
   the key string `rampLutOf` builds twice per region per frame today.
3. **Shader and twin**: `domainMin`/`domainMax` floats in `ldUniforms.slang`,
   normalisation in `ldRampColor` and `drawLDBlocks.ts`; `pnpm gen:shaders`
   (check its exit code).
4. **Surfaces**: menu radios keep their labels and write `['color','field']`;
   a Color scheme submenu moved from `plugins/hic/.../trackMenuItems.ts` into
   display-kit for both; `editPlotMenuItems`; `colorScales` built from
   `colorRamp` + `colorDomain` + the preset title (LegendMixin placement and
   gutter unchanged); a `notices` getter via `colorNotices` and
   `ConfigProblemsIndicator` in the component; `renderSvg.tsx` reads
   `renderState`.
5. **Writers**: `scripts/build_ag1000g_ld.sh` (hosted anoGam3 config; the
   lift covers it until redeploy), tutorials `ld_mosquitoes.md`,
   `ld_human.md`, `config_guides/variant_track.md`,
   `ideas/collections/tutorial-tours.md`, comments in `core/src/util/tabix.ts`
   and `PlinkLDAdapter`; `colorScales.test.ts`. `website/scripts/specs/ld.ts`
   still writes the v4 `showLDTriangle`, which the open schema drops silently:
   remove it in passing.
6. **Tests**, mirroring Hi-C's: schema (enum, presets, closed, lift),
   encoding parity with `continuousColorScale` per field, scheme, reverse and
   domain, `colorRamp`'s two dependencies, a radio writing `color.field` and
   `plot` reading it back, notices, the ldMarks textures-from-state test, a
   `setSession` load of a v4 `ldMetric: 'dprime'` session.

Not now: a LocusZoom-style `threshold` colouring (Manhattan's `ld` bins,
ADR-178) on the LD triangle.
