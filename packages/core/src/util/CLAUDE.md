# packages/core/src/util

Keep each module's type graph small:

- **Import a plain-data type (`Region`, file locations) from
  `./types/data.ts`**, not `./types/index.ts`, which drags in
  `AbstractSessionModel` and `PluginManager`.
- **Ask for the one session service a module needs** — `types/services.ts`
  (`RpcHost`, `PaletteHost`, `NotificationSink`, `DialogHost`) via
  `sessionServices.ts` — rather than `getSession`, which costs the whole
  application's types.
