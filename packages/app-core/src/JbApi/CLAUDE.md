# The agent surface

`jb` (`jbApi.ts`) serves two clients: Desktop's MCP server and `window.jb` on
JBrowse Web.

- **Keep every route a browser agent needs in `jb.help`.** It has no `docs`
  tool, so a route missing from that string is one it never takes; trim inside
  the string rather than dropping routes.
- **Before cutting a helper, drive the route you would name instead.**
  `view.launchTrack` drops settings written in its second slot and checks no
  assembly; `jb.setSession` is `applySnapshot`, so it runs no view launcher;
  `readConfObject` handed a model reads the MODEL's member, where `getConf`
  reads the config's (`getConf.test.ts`). `jb.rootModel` is the browser agent's
  only handle on the root model.
