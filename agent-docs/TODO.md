- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- aggressively refactor generate-screenshots
- group by strand plugins/canvas

## Coloring

Swap order in colo829


## links for color by strand, PUR



## vendor electron-updater


## Fused abortsignal+stoptoken?

## plugin versions


switched to URL-derived version and it's all green (core typecheck clean, 22 tests pass incl.
  5 new installedVersionFromUrl cases, eslint clean). The button/tooltip now read the installed
  version from the store-minted URL, not plugin.version.

  Now, your point about enhancing jbrowse-plugin-list instead — important distinction worth getting
  right:

  The producer can't actually help here, because the missing fact isn't an available-version fact —
  it's an installed-version fact. The manifest already gives you available versions as structured data
  (versions[].pluginVersion). What we need to know is which version this particular user already has
  in their saved config. The producer has no idea what any given user installed — that's per-user
  state living only in their config. So no amount of enhancing the plugin-list changes where the
  installed version comes from.

  There are really only two places the installed version can come from:

  - The install URL in the config (what I just implemented). Zero migration, works for every existing
  install today. Only assumption: the URL keeps the …/<packageName>/<version>/… shape your producer
  mints. Reliable as long as that convention holds.
  (versions[].pluginVersion). What we need to know is which version this particular user already has in their saved config. The producer has no idea what any given user installed — that's per-user state
  living only in their config. So no amount of enhancing the plugin-list changes where the installed version comes from.

  There are really only two places the installed version can come from:

  - The install URL in the config (what I just implemented). Zero migration, works for every existing install today. Only assumption: the URL keeps the …/<packageName>/<version>/… shape your producer
  mints. Reliable as long as that convention holds.
  - A version field written into the config at install time — the structured alternative. This is consumer-side, not producer-side: PluginCard already has resolved.pluginVersion in hand when it installs,
  so it could persist {...definition, pluginVersion} into the config. Then you read it straight back, no URL parsing, no convention dependency. This is the minimal slice of the "identity-in-config" idea —
  just one extra field, not a full redesign.

  The nice part: these compose. The robust end state is prefer the stored pluginVersion, fall back to URL-parsing — new installs get the clean structured value, and already-installed plugins (which predate
  the field) still work via the URL. The URL parser I wrote becomes the back-compat path rather than the primary one.

  So I'd keep the URL approach as-is (it's the back-compat floor you need regardless), and optionally layer the install-time pluginVersion field on top when you want to stop depending on the URL
  convention. Want me to add that install-time field now, or leave it at the URL approach and commit what's here?

  ## Refresh crash

[snap-trace] sessionStorage autosave: view#0(LinearGenomeView) tracks=0 persistence.ts:87:15
[snap-trace] migrateBasicSnapshot
Object { inType: "LinearBasicDisplay", outType: "LinearBasicDisplay", inKeys: (3) […], outKeys: (3) […] }
migrateBasicSnapshot.ts:139:11
[snap-trace] migrateBasicSnapshot
Object { inType: "LinearBasicDisplay", outType: "LinearBasicDisplay", inKeys: (3) […], outKeys: (3) […] }
migrateBasicSnapshot.ts:139:11
[snap-trace] migrateBasicSnapshot
Object { inType: "LinearBasicDisplay", outType: "LinearBasicDisplay", inKeys: (3) […], outKeys: (3) […] }
migrateBasicSnapshot.ts:139:11
[snap-trace] sessionStorage autosave: view#0(LinearGenomeView) tracks=1 ncbi_refseq_109_hg38_latest[FeatureTrack]{displays:1:LinearBasicDisplay} persistence.ts:87:15
Navigated to http://localhost:3000/?config=test_data%2Fconfig_demo.json&session=local-rqMouRArfG
Reloaded
Download the React DevTools for a better development experience: https://react.dev/link/react-devtools react-dom-client.development.js:28003:17
[snap-trace] setSession INPUT: view#0(LinearGenomeView) tracks=1 ncbi_refseq_109_hg38_latest[FeatureTrack]{displays:1:LinearBasicDisplay} BaseRootModel.ts:92:15
[snap-trace] migrateBasicSnapshot
Object { inType: "LinearBasicDisplay", outType: "LinearBasicDisplay", inKeys: (4) […], outKeys: (4) […] }
migrateBasicSnapshot.ts:139:11
[snap-trace] migrateBasicSnapshot
Object { inType: "LinearBasicDisplay", outType: "LinearBasicDisplay", inKeys: (4) […], outKeys: (4) […] }
migrateBasicSnapshot.ts:139:11
[snap-trace] migrateBasicSnapshot
Object { inType: "LinearBasicDisplay", outType: "LinearBasicDisplay", inKeys: (4) […], outKeys: (4) […] }
migrateBasicSnapshot.ts:139:11
[snap-trace] migrateBasicSnapshot
Object { inType: "LinearBasicDisplay", outType: "LinearBasicDisplay", inKeys: (4) […], outKeys: (4) […] }
migrateBasicSnapshot.ts:139:11
[snap-trace] migrateBasicSnapshot
Object { inType: "LinearBasicDisplay", outType: "LinearBasicDisplay", inKeys: (4) […], outKeys: (4) […] }
migrateBasicSnapshot.ts:139:11
[snap-trace] migrateBasicSnapshot
Object { inType: "LinearBasicDisplay", outType: "LinearBasicDisplay", inKeys: (4) […], outKeys: (4) […] }
migrateBasicSnapshot.ts:139:11
[snap-trace] setSession HYDRATED (pre-filter): view#0(LinearGenomeView) tracks=1 ncbi_refseq_109_hg38_latest[FeatureTrack]{displays:1:LinearBasicDisplay} BaseRootModel.ts:96:15
[snap-trace] walkChildOrDrop DROPPING child (childType=(LinearCanvasBaseDisplay | LinearAlignmentsDisplay | ChordVariantDisplay | DotplotDisplay | LinearSyntenyDisplay | LGVSyntenyDisplay | LinearReferenceSequenceDisplay | LinearCanvasBaseDisplay | LinearMultiSampleVariantDisplay | LinearMultiSampleVariantMatrixDisplay | LDDisplay | LDTrackDisplay | LinearWiggleDisplay | MultiLinearWiggleDisplay | LinearGCContentDisplay | LinearGCContentTrackDisplay | LinearMafDisplay | LinearHicDisplay | LinearArcDisplay | LinearPairedArcDisplay | LinearManhattanDisplay))
Object { error: "Error: width undefined, make sure to check for model.initialized", dropped: '{"id":"VbNinPZaMJ","type":"LinearBasicDisplay","configuration":"ncbi_refseq_109_hg38_latest-LinearBasicDisplay","showOnlyGenes":true}', stack: "get width@webpack://@jbrowse/web/../../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:395:15\ntrackDerivedFunction@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx@6.16.1/node_modules/mobx/dist/mobx.esm.js?:2043:18\ncomputeValue_@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx@6.16.1/node_modules/mobx/dist/mobx.esm.js?:1796:13\ntrackAndCompute@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx@6.16.1/node_modules/mobx/dist/mobx.esm.js?:1773:25\nget@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx@6.16.1/node_modules/mobx/dist/mobx.esm.js?:1742:18\ngetObservablePropValue_@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx@6.16.1/node_modules/mobx/dist/mobx.esm.js?:5131:23\nget@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx@6.16.1/node_modules/mobx/dist/mobx.esm.js?:5659:26\nget_@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx@6.16.1/node_modules/mobx/dist/mobx.esm.js?:5213:5\nget@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx@6.16.1/node_modules/mobx…" }
sessionUtils.ts:77:13
[snap-trace] setSession POST-FILTER: view#0(LinearGenomeView) tracks=1 ncbi_refseq_109_hg38_latest[FeatureTrack]{displays:0:} BaseRootModel.ts:106:17
[snap-trace] track has EMPTY displays in trackHeights
Object { trackId: "ncbi_refseq_109_hg38_latest", type: "FeatureTrack", displays: 0 }
model.ts:580:19
Reporting Header: invalid JSON value received. collect
The value of the attribute “expires” for the cookie “_ga_MB7C521GCN” has been overwritten. localhost:3000
TypeError: can't access property "height", t.displays[0] is undefined
    get trackHeights/< webpack://@jbrowse/web/../../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:586
    MobX 2
    get trackHeights webpack://@jbrowse/web/../../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:575
    MobX 8
    get trackHeightsWithResizeHandles webpack://@jbrowse/web/../../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:593
    MobX 8
    get height webpack://@jbrowse/web/../../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:602
    MobX 8
    viewHeight webpack://@jbrowse/web/../../packages/app-core/src/ui/App/ViewContainer.tsx?:32
    ViewContainer webpack://@jbrowse/web/../../packages/app-core/src/ui/App/ViewContainer.tsx?:62
    MobX 6
    React 12
    performWorkUntilDeadline webpack://@jbrowse/web/../../node_modules/.pnpm/scheduler@0.27.0/node_modules/scheduler/cjs/scheduler.development.js?:45
    EventHandlerNonNull* webpack://@jbrowse/web/../../node_modules/.pnpm/scheduler@0.27.0/node_modules/scheduler/cjs/scheduler.development.js?:223
    <anonymous> webpack://@jbrowse/web/../../node_modules/.pnpm/scheduler@0.27.0/node_modules/scheduler/cjs/scheduler.development.js?:364
    scheduler 0.27.0/node_modules/scheduler/cjs/scheduler.development.js@http://localhost:3000/static/js/bundle.js:512
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    <anonymous> webpack://@jbrowse/web/../../node_modules/.pnpm/scheduler@0.27.0/node_modules/scheduler/index.js?:5
    scheduler 0.27.0/node_modules/scheduler/index.js@http://localhost:3000/static/js/bundle.js:523
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    React 3
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    React 2
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    <anonymous> webpack://@jbrowse/web/./src/index.tsx?:4
    tsx http://localhost:3000/static/js/bundle.js:228
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    <anonymous> http://localhost:3000/static/js/bundle.js:2012
    <anonymous> http://localhost:3000/static/js/bundle.js:2014



The above error occurred in the <ViewContainer> component.

React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.
react-dom-client.development.js:9409:17
ErrorBoundary caught an error: TypeError: can't access property "height", t.displays[0] is undefined
    get trackHeights/< webpack://@jbrowse/web/../../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:586
    MobX 2
    get trackHeights webpack://@jbrowse/web/../../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:575
    MobX 8
    get trackHeightsWithResizeHandles webpack://@jbrowse/web/../../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:593
    MobX 8
    get height webpack://@jbrowse/web/../../plugins/linear-genome-view/src/LinearGenomeView/model.ts?:602
    MobX 8
    viewHeight webpack://@jbrowse/web/../../packages/app-core/src/ui/App/ViewContainer.tsx?:32
    ViewContainer webpack://@jbrowse/web/../../packages/app-core/src/ui/App/ViewContainer.tsx?:62
    MobX 6
    React 12
    performWorkUntilDeadline webpack://@jbrowse/web/../../node_modules/.pnpm/scheduler@0.27.0/node_modules/scheduler/cjs/scheduler.development.js?:45
    EventHandlerNonNull* webpack://@jbrowse/web/../../node_modules/.pnpm/scheduler@0.27.0/node_modules/scheduler/cjs/scheduler.development.js?:223
    <anonymous> webpack://@jbrowse/web/../../node_modules/.pnpm/scheduler@0.27.0/node_modules/scheduler/cjs/scheduler.development.js?:364
    scheduler 0.27.0/node_modules/scheduler/cjs/scheduler.development.js@http://localhost:3000/static/js/bundle.js:512
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    <anonymous> webpack://@jbrowse/web/../../node_modules/.pnpm/scheduler@0.27.0/node_modules/scheduler/index.js?:5
    scheduler 0.27.0/node_modules/scheduler/index.js@http://localhost:3000/static/js/bundle.js:523
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    React 3
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    React 2
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    <anonymous> webpack://@jbrowse/web/./src/index.tsx?:4
    tsx http://localhost:3000/static/js/bundle.js:228
    __webpack_require__ http://localhost:3000/static/js/bundle.js:1716
    <anonymous> http://localhost:3000/static/js/bundle.js:2012
    <anonymous> http://localhost:3000/static/js/bundle.js:2014

Object { componentStack: "\nobserverComponent@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx-react-lite@4.1.1_mobx@6.16.1_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/mobx-react-lite/es/observer.js?:53:73\ndiv@unknown:0:0\nobserverComponent@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx-react-lite@4.1.1_mobx@6.16.1_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/mobx-react-lite/es/observer.js?:53:73\nSuspense@unknown:0:0\ndiv@unknown:0:0\nobserverComponent@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx-react-lite@4.1.1_mobx@6.16.1_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/mobx-react-lite/es/observer.js?:53:73\ndiv@unknown:0:0\ndiv@unknown:0:0\nobserverComponent@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx-react-lite@4.1.1_mobx@6.16.1_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/mobx-react-lite/es/observer.js?:53:73\nDefaultPropsProvider@webpack://@jbrowse/web/../../node_modules/.pnpm/@mui+system@9.1.1_@emotion+react@11.14.0_@types+react@19.2.17_react@19.2.7__@emotion+st_7f8df650b071b3f8269f34d11d5f9842/node_modules/@mui/system/DefaultPropsProvider/DefaultPropsProvider.mjs?:17:30\nRtlProvider@webpack://@jbrowse/web/../../node_modules/.pnpm/@mui+system@9.1.1_@emotion+react@11.14.0_@types+react@19.2.17_react@19.2.7__@emotion+st_7f8df650b071b3f8269f34d11d5f9842/node_modules/@mui/system/RtlProvider/index.mjs?:15:21\nThemeProvider@webpack://@jbrowse/web/../../node_modules/.pnpm/@mui+private-theming@9.1.1_@types+react@19.2.17_react@19.2.7/node_modules/@mui/private-theming/ThemeProvider/ThemeProvider.mjs?:45:7\nThemeProvider@webpack://@jbrowse/web/../../node_modules/.pnpm/@mui+system@9.1.1_@emotion+react@11.14.0_@types+react@19.2.17_react@19.2.7__@emotion+st_7f8df650b071b3f8269f34d11d5f9842/node_modules/@mui/system/ThemeProvider/ThemeProvider.mjs?:67:7\nThemeProviderNoVars@webpack://@jbrowse/web/../../node_modules/.pnpm/@mui+material@9.1.1_@emotion+react@11.14.0_@types+react@19.2.17_react@19.2.7__@emotion+_8e16771da62564034e9bbd999c3f50bc/node_modules/@mui/material/styles/ThemeProviderNoVars.mjs?:15:29\nThemeProvider@webpack://@jbrowse/web/../../node_modules/.pnpm/@mui+material@9.1.1_@emotion+react@11.14.0_@types+react@19.2.17_react@19.2.7__@emotion+_8e16771da62564034e9bbd999c3f50bc/node_modules/@mui/material/styles/ThemeProvider.mjs?:17:23\nobserverComponent@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx-react-lite@4.1.1_mobx@6.16.1_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/mobx-react-lite/es/observer.js?:53:73\nobserverComponent@webpack://@jbrowse/web/../../node_modules/.pnpm/mobx-react-lite@4.1.1_mobx@6.16.1_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/mobx-react-lite/es/observer.js?:53:73\nLoader@webpack://@jbrowse/web/./src/components/Loader.tsx?:35:70\nErrorBoundary@webpack://@jbrowse/web/../../packages/core/src/ui/ErrorBoundary.tsx?:12:5\nLoaderWrapper@webpack://@jbrowse/web/./src/components/Loader.tsx?:68:70\nSuspense@unknown:0:0\nInitialLoad@webpack://@jbrowse/web/./src/InitialLoad.tsx?:30:70" }
ErrorBoundary.tsx:18:13
[snap-trace] disposePluginManager save: view#0(LinearGenomeView) tracks=1 ncbi_refseq_109_hg38_latest[FeatureTrack]{displays:0:} SessionLoader.ts:309:17
Error: [mobx-state-tree] You are trying to read or write to an object that is no longer part of a state tree. (Object type: 'LinearGenomeView', Path upon death: '/session/views/0', Subpath: 'tracks', Action: '/session/views/0.deactivate()'). Either detach nodes first, or don't use objects after removing / replacing them in the tree.
    MobX
