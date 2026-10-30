// A plain component re-renders for no MobX read, so a model property added to
// one later goes stale with nothing failing. The status chrome was
// "deliberately not an observer" until a height read landed in it and the
// display container stopped following a track resize.
const SVG_EXPORT_COMPONENT = '^(Svg|SVG)|Svg(Body|Layer|Frame|Figure)?$'
const unobservedComponentMessage =
  'Wrap the component: `observer(function Name() {…})`. A plain component never re-renders for a MobX read, so a model property read here goes stale silently. The one exception is a component a frozen SVG figure draws, since an observer there re-renders itself against the live model and tears the figure: name it Svg…, or say `// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure`.'
export const unobservedComponents = [
  {
    selector: `FunctionDeclaration[id.name=/^[A-Z]/]:not([id.name=/${SVG_EXPORT_COMPONENT}/]):has(JSXElement, JSXFragment)`,
    message: unobservedComponentMessage,
  },
  {
    selector: `VariableDeclarator[id.name=/^[A-Z]/]:not([id.name=/${SVG_EXPORT_COMPONENT}/]) > :matches(ArrowFunctionExpression, FunctionExpression):has(JSXElement, JSXFragment)`,
    message: unobservedComponentMessage,
  },
  {
    selector:
      'VariableDeclarator[id.name=/^[A-Z]/] > CallExpression[callee.name=/^(memo|forwardRef)$/]',
    message:
      'Wrap the component in `observer`, which memoizes as `memo` does and also tracks MobX reads: `observer(function Name() {…})`, or `observer(forwardRef(…))`.',
  },
]

export const noTrackWidthPx = {
  selector: "MemberExpression[property.name='trackWidthPx']",
  message:
    'Read `model.canvasWidthPx`, not `view.trackWidthPx`. Four view getters answer plausibly and MAF drifted onto the wrong one; the two agree today, so a second spelling is silent until one of them moves. See trackCanvasWidthPx in display-kit/foundationView.ts.',
}

// `rpcManager.call` reached two ways — off a binding, and off `getSession(…)` /
// `session` — and a payload built as an object literal rather than spread from
// something already carrying the handles.
const rpcCallArgs = [
  "CallExpression[callee.property.name='call'][callee.object.name='rpcManager']",
  "CallExpression[callee.property.name='call'][callee.object.property.name='rpcManager']",
]
// A spread is accepted as forwarding: the rule cannot see inside one, and the
// six call sites that use it are wrappers handing on a `BaseOptions`-shaped bag
// that declares both handles.
const missingRpcHandle = (handle: string) =>
  rpcCallArgs
    .map(
      call =>
        `${call} > ObjectExpression:not(:has(> Property[key.name='${handle}'])):not(:has(> SpreadElement))`,
    )
    .join(', ')

// `RpcHandles` is optional on `RpcCallArgs` and has to stay optional — a
// plugin-facing argument may be added optional and never made required
// (reference/PLUGIN_ABI_STABILITY.md), so the compiler cannot ask for these.
// Which leaves them exactly as forgettable as `RpcMethodType`'s own docstring
// describes: "the two handles every method receives are the two an author who
// did not write them down never forwards". `CoreGetExportData` shipped without
// either, so the Save-track-data dialog's cancel did nothing and its progress
// never moved.
//
// Silent is the whole problem, not absent — plenty of calls should report
// nothing (a memoized header read, a refName lookup, CoreFreeResources). This
// makes that a stated decision instead of an unnoticed one: disable the rule on
// the line and say why.
export const noUnreportedRpcCall = {
  selector: missingRpcHandle('statusCallback'),
  message:
    "This rpcManager.call passes no `statusCallback`, so whatever it does is invisible — a spinner with no phase label and no bar. Pass `ctx.statusCallback` (FetchContext / createAbortRotation), useFetch's, or the display's `makeStatusCallback`. If it should genuinely report nothing, `// eslint-disable-next-line no-restricted-syntax` with the reason. See https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PROGRESS_REPORTING.md.",
}
export const noUncancellableRpcCall = {
  selector: missingRpcHandle('signal'),
  message:
    'This rpcManager.call passes no `signal`, so nothing can stop the worker once the user moves on or closes the dialog — it keeps its in-flight HTTP reads too. Pass `ctx.signal`, or the signal useFetch hands the fetcher. If the work is genuinely uninterruptible or too short to matter, `// eslint-disable-next-line no-restricted-syntax` with the reason. See https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PROGRESS_REPORTING.md.',
}

// A display installs its upload; it does not wire the mixin's autorun pair
// itself. `attachRenderingBackend` keeps the callbacks from its FIRST call, so
// everything they close over has to be built inside the setup thunk — and eight
// displays each hand-rolling the attach was eight places for that to go wrong
// silently, since a later call just drops what it allocated. See ADR-079 and
// ADR-088.
export const noHandRolledAttach = {
  selector: "CallExpression[callee.property.name='attachRenderingBackend']",
  message:
    'Call installUpload rather than attachRenderingBackend. The mixin keeps the callbacks from the first call only, so an upload diff’s memo has to live in the setup thunk — the installer owns that, and a hand-rolled attach rebuilds and drops it on every context-loss recovery. See ADR-079.',
}

// `initialized` and `ready` are one-sided: neither ever goes true on the error
// path, so a `when` over either does not fail on a view whose assembly failed —
// it never settles at all, leaving a pending promise and whatever the caller
// meant to do next simply undone. That has surfaced twice as bugs — an SVG
// export hung behind its spinner, a launched breakpoint split view that opened
// but was never navigated — and once by inspection, `navToLocations` parked on
// a view that never mounted. `whenViewSettled`'s docstring carries the
// reasoning.
//
// The bare promise form. `when(pred, effect)` is exempt because it is a
// reaction: a predicate that never comes true leaves it undisposed and its
// effect unrun, which is a leak rather than a parked caller.
//
// Arity is how that exemption is spelled, and it is not the same distinction:
// `when(pred, { timeout })` is promise-form and bounded (mobx rejects it), but
// so is `when(pred, {})`, which is neither exempt nor caught. A named-function
// predicate (`when(present, …)`, assemblyManager) and `mobx.when` are missed
// for the same kind of reason. This fails the shape that has actually shipped
// three times; it is not a proof.
//
// Source only. A test calls `setWidth(800)` synchronously, so the bare form is
// honest there, and 22 occurrences use it.
export const noOneSidedViewWait = {
  selector:
    "CallExpression[callee.name='when'][arguments.length=1] > ArrowFunctionExpression:has(MemberExpression[property.name=/^(initialized|ready)$/]):not(:has(MemberExpression[property.name='error']))",
  message:
    'This `when` waits on `initialized`/`ready`, which never go true on the error path, so a view whose assembly failed parks it forever. Use `whenViewSettled(view, escape?)` or `whenViewsSettled(views, escape?)` from @jbrowse/core/util/whenViewSettled; inside an installInitAutorun `apply`, the escape is `superseded`. See https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/VIEW_INIT.md.',
}

// `session.addTrackConf` survives only so that prebuilt plugin bundles keep
// working (protein3d calls it), and it now means `addSessionTrackConf`. Nothing
// in tree may reach for it: the name reads like the general capability and used
// to publish an admin's track into the config.json every visitor is served,
// which is how the blat hits, the consensus VCF, the motif scans and the
// derivative-allele labels each shipped one dead entry per click.
export const noSessionAddTrackConf = {
  selector:
    "MemberExpression[object.name=/^(session|sess)$/][property.name='addTrackConf'], Identifier[name='isSessionWithAddTracks']",
  message:
    'Call `session.addSessionTrackConf` for a track a feature stands up on the user’s behalf, or `session.publishTrackConf` in an Add-track workflow where an admin means to add it for the whole site — and gate on the matching `isSessionWithAddSessionTrack` / `isSessionWithPublishTrackConf`. `addTrackConf` and `isSessionWithAddTracks` survive only for prebuilt plugin bundles.',
}

// `rpcProps`, `zoomFetchArgs`, `regionHasData` and `isCacheValid` are the
// method-shaped fetch hooks read from reactive contexts, and MST decides what a
// member IS from the block it is declared in. `.actions()` makes it an action,
// MobX runs an action inside `untracked`, and the hook then returns the right
// value while registering none of the observables it read. ADR-044 rejected this rule in
// 2026-07 on the grounds that a lint pass "would see the easy cases and miss
// precisely the 210-line-block case that shipped"; two of the three escapes it
// named — a 210-line `.actions()` block, and a super-capture override that
// returns its object from a block body — are plain syntax and are matched here.
// A helper factory spread into the block is the one that is not.
export const noFetchHookInActions = {
  selector: [
    "CallExpression[callee.property.name='actions'] > ArrowFunctionExpression > ObjectExpression > Property[key.name=/^(isCacheValid|regionHasData|rpcProps|zoomFetchArgs)$/]",
    "CallExpression[callee.property.name='actions'] > ArrowFunctionExpression > BlockStatement > ReturnStatement > ObjectExpression > Property[key.name=/^(isCacheValid|regionHasData|rpcProps|zoomFetchArgs)$/]",
  ].join(', '),
  message:
    'Declare `rpcProps`, `zoomFetchArgs`, `regionHasData` and `isCacheValid` in a `.views()` block, never `.actions()`. MST turns whatever an `.actions()` block declares into an action and MobX runs an action inside `untracked`, so the hook still returns the right value when called and simply stops registering the observables it read — every autorun and computed calling it keeps a stale answer until something else it happens to depend on changes. Nothing throws and nothing logs, and the block opener deciding a member’s fate is often hundreds of lines above it: multi-sample-variant shipped a byte gate that evaluated `false` once before init and never re-evaluated, and multi-row shipped an `isCacheValid` inside a 210-line `.actions()` block that only looked harmless because `FetchVisibleRegions` re-fired for its own reasons. Move the declaration into a `.views()` block, or make the hook a getter — MST throws on a getter inside `.actions()`. See https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/architecture-decision-records/adr-044-reactive-display-hooks-are-getters-or-pinned-views.md.',
}

// `FeatureGateMixin` and `RegionTooLargeMixin` (which
// `MultiRegionDisplayMixin` brings in) both declare `gateEnabled` and
// `densityTooLarge`, and `types.compose` resolves a member collision by
// ARGUMENT POSITION — so which of two arguments in one call comes first is the
// whole difference between a gated display and one that downloads whatever the
// viewport covers. esquery's sibling combinator reads exactly that: the base
// mixin is reported when the gate mixin already appeared earlier in the same
// argument list. Neither mixin's own declaration is a call, so no file needs a
// carve-out. What it cannot see is a gate mixin composed ahead of a base MODEL
// that carries the foundation, which is a different file's compose;
// REGION_TOO_LARGE.md says so rather than implying coverage.
export const noGateMixinComposedFirst = {
  selector:
    "CallExpression[callee.name='FeatureGateMixin'] ~ CallExpression[callee.name='MultiRegionDisplayMixin']",
  message:
    'FeatureGateMixin() must be composed AFTER MultiRegionDisplayMixin(), and this types.compose has them the other way round. Both declare `gateEnabled` and `densityTooLarge` — the gate mixin contributes the opt-in and the density verdict, RegionTooLargeMixin (which MultiRegionDisplayMixin brings in) defaults both `false` — and types.compose resolves a member collision to the LATER argument, so composing the gate first hands them back to those defaults. The entire region-too-large gate is then off for this display: no banner, no error, nothing the type system objects to, and the track downloads whatever the viewport covers. Move FeatureGateMixin() below MultiRegionDisplayMixin() in the same call. See https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REGION_TOO_LARGE.md.',
}

// `HeightModeMixin` composes `TrackHeightMixin` and overrides its `height`
// getter and `resizeHeight` action. A second `TrackHeightMixin()` beside it in
// one `types.compose` either does nothing or, written after it, takes both
// back, since a collision goes to the later argument.
export const noTrackHeightBesideHeightMode = {
  selector:
    "CallExpression[callee.name='HeightModeMixin'] ~ CallExpression[callee.name='TrackHeightMixin'], CallExpression[callee.name='TrackHeightMixin'] ~ CallExpression[callee.name='HeightModeMixin']",
  message:
    'HeightModeMixin() already composes TrackHeightMixin(), so keep HeightModeMixin() alone in this types.compose. A TrackHeightMixin() written after it takes back the `height` getter and `resizeHeight` action HeightModeMixin overrides, since types.compose gives a collision to the later argument: the track height stops following the laid-out content in grow mode and a drag-resize no longer leaves grow, with nothing erroring.',
}

// The MST fork types `types.compose` for eleven model parts after the optional
// name. A twelfth compiles against no overload, and what a reader sees is not
// a ceiling but the composed model losing every prop: ~150 "property X does
// not exist" errors across every consumer of the display. The selector counts
// arguments including the name string, so twelve arguments is eleven parts
// plus a name, and thirteen is the first that fails.
export const noTenthComposePart = {
  selector:
    "CallExpression[callee.object.name='types'][callee.property.name='compose'][arguments.length>12], CallExpression[callee.object.name='types'][callee.property.name='compose'][arguments.length=12]:not(:has(> Literal.arguments:first-child))",
  message:
    'types.compose takes at most eleven parts, and a twelfth erases every prop of the result instead of failing at this call. Nest the parts every LGV display shares — `types.compose(BaseDisplay, TrackHeightMixin(), MultiRegionDisplayMixin())` — as one part, the way LinearMarkDisplay does.',
}

// React 19.2's dev-only component performance track diffs a changed prop by
// walking it, and `Object.prototype.toString` puts a typed array on neither the
// Array nor the plain-object path — so react-dom's `addObjectToProperties`
// enumerates it with `for...in`, one property row per element, no cap, for the
// previous value and the next one both. Hic's tooltip took `data={rpcData}`,
// whose `instances` is `numContacts * 3` floats: a Chrome profile of one pan
// under the cursor measured 6.8s of "Run console task" and a heap climbing 76MB
// to 1767MB, against 217ms of actual JBrowse work in the same trace.
//
// A payload is a worker result, so it is exactly the object that is all typed
// arrays, and `rpcData` is what every display in the tree calls it. Pass what
// the child reads — the two formatted loci and a number, in hic's case — and
// the walk has nothing to enumerate. The sweep behind the fix found no other
// site, so this holds a cleared field rather than describing a backlog.
//
// What it cannot see is a payload reaching a prop under another name, or via a
// local bound off one. Both are a level of indirection past syntax; the
// spelling this matches is the one that shipped.
export const noPayloadThroughAProp = {
  selector:
    "JSXAttribute > JSXExpressionContainer > MemberExpression[property.name='rpcData']",
  message:
    "Do not hand a whole worker payload to a React prop. React 19.2's dev-only performance track diffs a changed prop by walking it, and it walks a typed array element by element with no cap — `rpcData` is all typed arrays, so this costs one property row per element, twice, on every re-render where the payload changed. Hic's tooltip did exactly this and a single pan with the cursor over the track spent 6.8s and ~1GB. Pass what the child actually reads (the formatted strings, the numbers) instead of the object they came off — plugins/hic/src/LinearHicDisplay/components/ReactComponent.tsx is the worked example.",
}

// useEffectEvent returns a stale closure inside mobx-react observer() components
// (its useInsertionEffect impl-swap does not run under observer's reactive
// render), and nearly every JBrowse component is an observer.
export const noUseEffectEvent = {
  name: 'react',
  importNames: ['useEffectEvent'],
  message:
    'useEffectEvent reads stale state inside mobx-react observer() components. Use useEventCallback from @jbrowse/core/util/useEventCallback instead.',
}

export const displayRestrictedSyntax = [
  noOneSidedViewWait,
  noSessionAddTrackConf,
  noTrackWidthPx,
  noUnreportedRpcCall,
  noUncancellableRpcCall,
  noHandRolledAttach,
  noFetchHookInActions,
  noGateMixinComposedFirst,
  noTrackHeightBesideHeightMode,
  noTenthComposePart,
  noPayloadThroughAProp,
]
