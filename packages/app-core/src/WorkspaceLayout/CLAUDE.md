# WorkspaceLayout

- **Keep every `tree.ts` function total** (unknown id, tree unchanged), and test
  tree and model separately: the model's guards hide tree bugs.
- **Add every new tree operation to `tree.test.ts`'s 2000-step sequence.**
- **Route every pointer gesture through `usePointerGesture`**; its pointer
  capture is also what stops a drag selecting text.
- **Only the shown tab is mounted** (each display costs a WebGL2 context): a tab
  switch unmounts the old tab's views and mounts a fresh `ViewStack`.
- **Add arguments to `setPendingMove`, `applyLayoutSpec` and `layoutViews` as
  optional.** Plugins (protein3d, msaview) and `loadSessionSpec` reach them
  behind `in` guards, so a rename or a required argument compiles and the caller
  silently stops using it.
