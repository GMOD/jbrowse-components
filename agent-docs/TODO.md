## test speedups
  You were right that the import graph is the problem — but it's only ~⅓ of the cost.

  ┌──────────────────────┬─────────┬───────┐
  │       Variant        │ Modules │ Time  │
  ├──────────────────────┼─────────┼───────┤
  │ Pure noop test       │       1 │ 0.73s │
  ├──────────────────────┼─────────┼───────┤
  │ 5 plugins            │     381 │ 2.58s │
  ├──────────────────────┼─────────┼───────┤
  │ Current (30 plugins) │   1,512 │ 3.33s │
  ├──────────────────────┼─────────┼───────┤
  │ Real test (10 tests) │  1,512+ │ 11.3s │
  └──────────────────────┴─────────┴───────┘

  The math for a 2× warm-cache win:
  - Trim corePlugins to per-test minimum: saves ~0.7s/file → ~10% on heavy tests, ~25% on light tests
  - Share JBrowse mount across tests in same file: saves ~3–5s per heavy file
  - Combined: realistic path to ~1.6–1.8×. Honest 2× requires both.

  SWC / esbuild / Vitest: 0% local warm-cache help. Confirmed by profile (babel is 1.8% CPU on real
  tests).

  What I'd actually do, in order:
  1. Make getPluginManager() in util.tsx accept a plugin list (default = corePlugins). Migrate the
  lightest tests to pass [LinearGenomeView, Config, Menus, Sequence, DataManagement]. Quick win, low
  risk.
  2. Audit one heavy plugin barrel (e.g. linear-comparative-view/src/index.ts reaches 504 files) to
  see if non-lazy imports can become lazy() — would benefit all tests.
  3. Only then consider sharing mounts across tests — bigger refactor, harder to keep correct.

  If you want, I can do step 1 as a real PR (refactor util.tsx + convert ~5 light tests) and measure
  the suite delta.


## Autogen docs


 Two notes worth flagging:
  1. plugins/variants/src/shared/SharedVariantConfigSchema.ts has a #slot JSDoc on a
  ...sharedVariantConfigSlots spread; the new extractor honours it and emits a blank-named slot. The
  old code silently dropped it. Either remove that #slot JSDoc or push the per-slot JSDocs down to
  where the fields are actually declared.
  2. The README's instructions for the dummy-function workaround were rewritten to describe the actual
   JSDoc-adjacency rule.

## Canvas

### Skipped intentionally (decisions worth remembering)

- **Hoist `fetchFeaturesForRegion` / `applyFetchResults` out of the
  `.actions(self =>)` closure.** Would require typing `self` either as
  `Instance<typeof stateModelFactory>` (circular type ref) or as a structural
  type — reintroducing exactly the drift risk that `modelContract.ts` exists
  to prevent. Negative-value refactor.
- **Merge the three chained `.views(self =>)` blocks around
  `regionTooLarge`.** Would force sibling refs through `this.X`, violating
  the `self-over-this in views` memory.
- **`assemblyNames[0]!` non-null assertion** at `baseModel.ts:222` and
  `model.ts:238`. Config schema requires assemblyNames to be a non-empty
  array, so the `!` documents a real invariant.

### Anti-recommendations (do not do)

- Don't merge `interleaveRects/interleaveLines/interleaveArrows` in
  `interleaveBuffers.ts` into a parametric function — field-by-field
  correspondence with shader-generated offsets is the point
  (`feedback_complexity_not_loc.md`).
- Don't merge the three `if numXxx > 0` blocks in
  `GpuCanvasFeatureRenderer.uploadRegion`. Same reason.
- Don't split `packRenderArrays` into a parametric primitive packer. Same
  reason — the explicit per-primitive column list documents the GPU
  contract.
- Don't extract `getFeatureName` / `getFeatureDescription` further; they're
  already in `labelUtils.ts`.


## jbrowse-img


Check --configtracks refseq, we want to be able to render sequence track easily


## Alignments/maf


Architecture Observation (informational, not a bug)

The three-loop pattern in computeNoncovCoverage mirrors the same Map.get + default-create + increment pattern that appears for insertions, softclips, and hardclips. This is the most structurally repetitive part of the pipeline — a small accumulate(map, items, field) helper (as shown above in finding #2) would cut the file from 183 lines to roughly 150 while making the logic much easier to scan.

The MAF coverage path is correctly narrower than alignments (no noncov, no mod coverage) and correctly shares computeSNPCoverage and packCoverageBinsForGpu/packSnpSegmentsForGpu from alignments-core. The main opportunity is finding #3 above — computeMafCoverage can shed the intermediate MismatchEntry[].

✻ Worked for 7m 2s

❯ do whatever you think is best. if helpful you can create new helper functions, or react components, or tighten types. note that MAF can have insertions, so it does need 'noncov' i think (noncov includes insertions and interbase events. it might even want to be renamed interbase)

Let me understand the scope of the noncov→interbase rename and the MAF insertion situation before diving in.

  Searched for 2 patterns, ran 2 shell commands

The rename touches ~30 files including generated shaders. Let me check what the slang source looks like and if I can regenerate.

## auth



OAuthModel/model.tsx: listener variable can leak

The listener variable is a single slot in a closure. If addMessageChannel is called twice (e.g., a user somehow triggers two auth flows), the first listener reference is overwritten and deleteMessageChannel can no longer remove it — it leaks permanently on window. A simple fix: make addMessageChannel return the remove function, or have deleteMessageChannel track the actual function reference per-call.

DropboxOAuthModel/model.tsx: getFetcher skips validateToken

The base OAuth getFetcher calls validateToken before every fetch:
const token = loc ? await self.validateToken(await self.getToken(loc), loc) : await self.getToken()
But Dropbox's override just calls self.getToken(location) directly without validating. This means Dropbox won't attempt the refresh-oss provides. The base validateTokendoes a HEAD request first; Dropbox overrides validateToken with its own API call — but that
validation is never invoked by getFtent bug where Dropbox requestswon't transparently refresh expired tokens.

OAuthModel/model.tsx: redirectUri variable shadowing

Inside useEndpointForAuthorization, the outer redirectUri const is shadowed by an inner const redirectUri in the Electron branch:
const redirectUri = isElectron ? 'http://localhost/auth' : ...
// ...
if (isElectron) {
  const redirectUri = await ipcRendouter
The inner redirectUri is what gets sent to finishOAuthWindow, which is correct. But the outer
redirectUri was already set to 'httpassed into the ipcRenderer.invokecall as part of data. They're used differently — the outer one is the redirect URI registered with
the OAuth server, and the inner oneeturned by Electron after auth. Thenaming conflation here makes it easy to mix these up. Worth renaming one of them.

OAuthModel/model.tsx: state() is a method, not a getter

state(): string | undefined {
  return getConf(self, 'state')
},
All the other views are getters (ged(), etc.), but state is a plainmethod. Call sites use self.state() which works, but it's inconsistent with the pattern of the
surrounding code. Whether this is i overriding with return undefined)or accidental isn't clear from the code, but the inconsistency is worth noting.

GoogleDriveOAuthModel/model.tsx: file ID regex is too greedy

const urlId = /[-\w]{25,}/.exec(str)
This matches any 25+ character worde file IDs are typically 33characters of [a-zA-Z0-9_-], but this regex would also match long path segments in unrelated URLs. A
 URL like https://drive.google.com/jgmUUqptlbs74OgVE2upms/view wouldcorrectly extract 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms, but a URL with a long hostname or
path component could match unintentc pattern like/\/d\/([-\w]{25,})/.exec(str) would be safer.

GoogleDriveFilehandle.ts: unhandled statsPromise rejection

The statsPromise is created in the constructor with no error handling:
this.statsPromise = this.fetch(sourhen(response => response.json())
If the fetch fails (auth error, network error), this becomes an unhandled rejected promise until
stat() is called. In Node.js envirohandledPromiseRejectionWarning.Adding .catch(() => {}) to suppress it (letting stat() re-throw when called) or initializing it
lazily would be cleaner.

The listener leak and Dropbox getFeare the most likely to cause realuser-facing problems. Would you like me to fix any of these?

✻ Crunched for 28s

❯ if it helps you can try to do validate against real remote files. we have some in our
  test_data/volvox auth examples. youelps. you can also try to convertto 'normal async/await' if it helps code flows and clean do anything else you think is worthwhile

  Searched for 3 patterns, read 4 files, ran 1 shell command
Loaded products/jbrowse-web/CLAU

Let me look at how getTokenFromUserto understand the callback pattern:

## desktop
Now inline the setXAndReset helpers in GenomesDataTable:

● Update(products/jbrowse-desktop/src/components/StartScreen/availableGenomes/GenomesDataTable.tsx)
Removed 13 lines
  )
  const [showAllColumns, setShowAllColumns] = useState(false)

  // Reset to first page whenever the result set changes so we don't land on an empt
y page
  const setSearchQueryAndReset = (q: string) => {
    setSearchQuery(q)
    setPageIndex(0)
  }
  const setFilterOptionAndReset = (f: FilterOption) => {
    setFilterOption(f)
    setPageIndex(0)
  }
  const setTypeOptionAndReset = (t: string) => {
    setTypeOption(t)
    setPageIndex(0)
  }
  const tableRef = useRef<HTMLDivElement>(null)
  useSearchHighlight(tableRef, searchQuery)
  const { classes } = useStyles()

Now update the three call sites to inline the reset:

● Update(products/jbrowse-desktop/src/components/StartScreen/availableGenomes/GenomesDataTable.tsx)
Added 8 lines, removed 2 lines

        <SearchField
          searchQuery={searchQuery}
          onChange={setSearchQueryAndReset}
          onChange={q => {
            setSearchQuery(q)
            setPageIndex(0)
          }}
        />

        <CategorySelector

          typeOption={type
          categoriesLoading={categoriesLoading}
          categoriesError=
          onChange={setTypeOptionAndReset}
          onChange={t => {
            setTypeOption(t)
            setPageIndex(0
          }}
        />
        <CascadingMenuButton
          menuItems={() =>
