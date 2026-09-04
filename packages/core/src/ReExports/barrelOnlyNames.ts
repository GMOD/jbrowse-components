// Names a source barrel exports that its ABI file deliberately does not serve.
//
// The public*.ts split stopped a barrel removal from silently narrowing the ABI
// -- take a name out of ui/index.ts and publicUi.tsx no longer compiles. This
// closes the other direction, which the split opened: a name *added* to a barrel
// is not served until someone adds it here too, and an external plugin cannot
// see that. Its `import { X } from '@jbrowse/core/ui'` type-checks, because
// package.json's `./ui` resolves to the barrel, and reads undefined off
// JBrowseExports at runtime -- the same shape of failure a removal used to
// cause, just for new code instead of old.
//
// So publicSurface.test.ts requires barrel-minus-ABI to be exactly this list.
// Adding an export to a barrel then fails until the ABI question is answered,
// and either answer is one line: serve it from the public*.ts file, or name it
// here. Nothing about being on this list is wrong -- most of these are helpers
// for app code, session plumbing and in-tree hooks that a plugin has no use for.
export const BARREL_ONLY_NAMES = {
  '@jbrowse/core/ui': [],
  '@jbrowse/core/util/tracks': [],
  '@jbrowse/core/util': [
    'MAX_GLOB_REGIONS',
    'adapterNeedsAddTrackComponent',
    'assembleLocStrings',
    'canonicalizeViewRefName',
    'clampToContig',
    'clampToListedContig',
    'containerDisplaysAssembly',
    'downloadPhase',
    'finishAddTrack',
    'formatBytes',
    'getDisplayStr',
    'getLocationUri',
    'handleFetchError',
    'indexedDBAvailable',
    'installablePlugins',
    'isSessionWithMultipleViews',
    'isSessionWithPermanentPlugins',
    'isWebWorker',
    'localStorageAvailable',
    'localStorageGetStringArray',
    'matchRefNames',
    'measuredFont',
    'namesTemporaryAssembly',
    'notifyFeatureDetailsMiss',
    'notifyLocalStorageKey',
    'parseBpString',
    'parseRegionNames',
    'resolveNamedRegions',
    'resolveStorePluginRefs',
    'resolveStoreRefs',
    'resolveUri',
    'sessionStorageAvailable',
    'sessionStorageGetItem',
    'sessionStorageRemoveItem',
    'sessionStorageSetItem',
    'statusSource',
    'subscribeToLocalStorageKey',
    'throttleStatusEmits',
    'useCreateOnce',
    'useFinalUnmount',
    'withFeatureDetails',
  ],
}
