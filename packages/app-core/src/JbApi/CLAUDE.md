# The agent surface

`jb` (`jbApi.ts`) is one library with two clients: Desktop's MCP server —
`run_javascript`, `docs`, `open`, `screenshot` — and `window.jb` on JBrowse Web.
The briefing differs, and that is what gets missed.

- **A browser agent has no `docs` tool.** `jb.help` is its entire contract, so a
  route missing from that string is a route it never takes. Trim inside it, not
  the routes. `products/jbrowse-desktop/src/mcp/docsRoster.test.ts` pins the
  load-bearing members in the copies read before any doc, and every `jb.X` any
  copy names.
- **The client cuts the server instructions and each tool description at 2048
  characters**, so an addition displaces a sentence someone chose.
  `pnpm check-mcp-text-caps` gates it, `--probe` re-measures the installed
  client.
- **Before cutting a helper, drive the route you would name instead.**
  `view.launchTrack` drops settings written in its second slot and checks no
  assembly; `jb.setSession` is `applySnapshot`, so it runs no view launcher;
  `getConf` is not `readConfObject` with extra steps, because readConfObject
  handed a model reads the MODEL's member (`getConf.test.ts`). `jb.rootModel` is
  the browser agent's handle on Web, where nothing passes rootModel as a call
  argument. Three reviews proposed cuts onto these without driving any.
