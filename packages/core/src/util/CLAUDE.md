# packages/core/src/util

Keep each module's type graph small:

- **A plain-data type (`Region`, file locations) comes from `./types/data.ts`**,
  not `./types/index.ts`, which drags in `AbstractSessionModel` and
  `PluginManager`.
- **A module wanting one session service asks for that slice** —
  `types/services.ts` (`RpcHost`, `PaletteHost`, `NotificationSink`,
  `DialogHost`) via `sessionServices.ts` — not `getSession`, which costs the
  whole application's types. `AssemblyHost`/`RenderingServices` cost the whole
  graph regardless, so they stay in `types/renderingServices.ts`.
- `@jbrowse/core/util` is plugin ABI: never drop anything from the barrel
  (`reference/PLUGIN_ABI_STABILITY.md`).
