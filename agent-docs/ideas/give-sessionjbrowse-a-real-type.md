---
name: give-sessionjbrowse-a-real-type
description: `session.jbrowse` is `any` in every product — 144 read sites, 36 that do something with it — and the generic that looks like the principled fix is measured not to work, because `types.compose` cannot infer through a naked type parameter. What is open is one structural interface or two, since app-core's config model and product-core's genuinely differ.
---

# Give `session.jbrowse` a real type

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. A 36-site internal typing job whose shape has to be
picked before site one, and no published behaviour moves when it lands.

`session.jbrowse` and `root.jbrowse` are **`any`** in every product, so every
`.tracks`, `.assemblies`, `.addTrackConf(...)` off them is unchecked — a typo or
a wrong argument compiles. `AbstractSessionModel` and `AbstractRootModel` both
declare it `IAnyStateTreeNode`, which is `any`, so narrowing to the abstract
contract does not help either. 144 read sites over 77 files; annotating the
getter `unknown` surfaces **36** that do something with it, across app-core,
product-core and plugins. That 36 is the real size of the job.

**Do not reach for a generic — it is measured and it does not work.**
`BaseRootModelFactory` takes `jbrowseModelType: IAnyType`, and making it
`<JB extends IAnyModelType>` looks like the principled fix. It leaves
`root.jbrowse` exactly as `any`: every product composes the factory's result,
and `types.compose`'s overloads are declared over `IModelType<P, O, FC, FS>`, so
a model arriving as a naked type parameter has nothing to infer those four from
and the result degrades. Same limitation as the embedded session factory in
[reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md#config-and-mst) —
twice now, on unrelated models, which is what makes it a property of `compose`
rather than of either attempt.

So it has to be a hand-written structural interface, the way `Widget` already
serves `visibleWidget`. What it must cover, counted off the call sites: `tracks`
(24), `assemblies` (13), `plugins` (10), `connections` (9), `configuration` (5),
`defaultSession`, and the editing actions `updateTrackConf` (8),
`addTrackConf`/`addConnectionConf`/`addAssemblyConf`/`removePlugin` (3 each),
`removeAssemblyConf`/`deleteTrackConf`/`deleteConnectionConf`.

**The open decision, and the only hard part: the two config models genuinely
differ.** app-core's `JBrowseModelF` (web/desktop/react-app) has `assemblies`
and all the editing actions; product-core's `createConfigModel` (the embedded
products) has `assembly` **singular** and none of the actions. One interface with
the actions optional makes ~20 mutator call sites guard for something that is
always there in the products that call them. Two interfaces — a read surface both
satisfy, plus an editing surface only the app one does — is the better shape but
needs each of the 36 sites sorted into which it wants. Pick before starting; the
first spelling is not the one to discover at site 20.

Pin the result with `AssertNotAny<IsAny<...>>` when it lands, the way the
embedded products' `session`/`session.view` already are.
