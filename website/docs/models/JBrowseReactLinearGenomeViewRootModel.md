---
id: jbrowsereactlineargenomeviewrootmodel
title: JBrowseReactLinearGenomeViewRootModel
sidebar_label: Root -> JBrowseReactLinearGenomeViewRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/src/createModel/createModel.ts).

Composes the shared EmbeddedRootModel with a LinearGenomeView session plus the
LGV-only `disableAddTracks`/`height` props.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-disableaddtracks">**disableAddTracks**</span><br><code>disableAddTracks: types.stripDefault(types.boolean, false)</code> |  |
| <span id="property-height">**height**</span><br><code>height: types.maybe(types.string)</code> | Any CSS height, applied to the component's own root whether or not a drawer is open. Absent, the component is content-height and grows with the page, and the host's box is what bounds it. |
| <span id="property-drawerviewheight">**drawerViewHeight**</span><br><code>drawerViewHeight: types.stripDefault(types.string, '100vh')</code> | Superseded by `height`, which does the same thing without the "only while a drawer is open" condition. Still honored when `height` is absent. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-effectiveheight">**effectiveHeight**</span><br><code>string &#124; undefined</code> | The height in force: `height` when a host gave one, `drawerViewHeight` while a drawer is open, and nothing otherwise -- the view is content-height and the host's own box is what bounds it.<br><br>One definition with two readers, and the second is why it is here rather than in the component: a bounded view is exactly the case where pinning the header means something, so the session's `stickyViewHeaders` reads this too. |
