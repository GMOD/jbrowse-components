Dotplot shaders are authored in `shaders/dotplot.slang` and generated into
`shaders/dotplot.generated.ts` via `pnpm gen:shaders`. The generated module is
the single source of truth for WGSL, GLSL ES 300, instance stride, field
offsets, and GL attribute layout. See `agent-docs/SLANG_MIGRATION_NEXT_STEPS.md`
and `agent-docs/architecture-decision-records/adr-005-shader-codegen-slang.md`.
