## Extension-point cleanup

`PluggableComponent` (`packages/core/src/ui/PluggableComponent.tsx`) wraps the
`evaluateExtensionPoint(name, Default, props) as React.ComponentType<P>` +
inline-render pattern. A few remaining call sites don't fit the helper as-is:

- *`Core-extraAboutPanel`* (`packages/product-core/src/ui/AboutDialogContents.tsx:48`)
  returns `{ name, Component }` so the host can wrap it in a titled `BaseCard`.
  To use `PluggableComponent`, change the contract so the extension returns a
  component that renders its own card (or expose `name` via a static prop). API
  break for any plugin registering this extension point — none in-tree today,
  but worth checking external plugins before changing.

- *`Core-extraFeaturePanel`* (`packages/core/src/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails.tsx:46`)
  — same `{ name, Component }` shape as above, same fix.

- *`TrackSelector-folderDialog`* (`plugins/data-management/src/HierarchicalTrackSelectorWidget/components/tree/TrackCategory.tsx:73`)
  resolves a component then hands `[Component, props]` to `session.queueDialog`.
  `PluggableComponent` doesn't help because the rendering is deferred to the
  dialog queue. Could either teach `queueDialog` to accept a
  `PluggableComponent`-style descriptor, or leave as-is — low value.


