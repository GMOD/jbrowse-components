import {
  DefaultSession,
  DisableAddTrack,
  ExternalNavigateLocstring,
  ExternalNavigateObject,
  HorizontallyFlippedViaButton,
  HorizontallyFlippedViaDisplayedRegions,
  HorizontallyFlippedViaLocstring,
  HumanExomeExample,
  NextstrainExample,
  OneLinearGenomeView,
  ShadowDOMOneLinearGenomeView,
  UsingLocObject,
  WithAggregateTextSearching,
  WithCustomTheme,
  WithDarkTheme,
  WithDisableZoomAndSideScroll,
  WithErrorHandler,
  WithExternalPlugin,
  WithInit,
  WithInlinePlugins,
  WithInternetAccounts,
  WithMultipleDisplayedRegionsFlipped,
  WithObserveVisibleFeatures,
  WithObserveVisibleRegions,
  WithOutsideStyling,
  WithPerTrackTextSearching,
  WithReact18,
  WithShowTrack,
  WithTwoLinearGenomeViews,
  WithWebWorker,
} from './examples/index.ts'

import DefaultSessionSource from '!!./raw-source-loader.cjs!./examples/DefaultSession.tsx'
import DisableAddTrackSource from '!!./raw-source-loader.cjs!./examples/DisableAddTrack.tsx'
import ExternalNavigateLocstringSource from '!!./raw-source-loader.cjs!./examples/ExternalNavigateLocstring.tsx'
import ExternalNavigateObjectSource from '!!./raw-source-loader.cjs!./examples/ExternalNavigateObject.tsx'
import HorizontallyFlippedSource from '!!./raw-source-loader.cjs!./examples/HorizontallyFlipped.tsx'
import HumanExomeExampleSource from '!!./raw-source-loader.cjs!./examples/HumanExomeExample.tsx'
import NextstrainExampleSource from '!!./raw-source-loader.cjs!./examples/NextstrainExample.tsx'
import OneLinearGenomeViewSource from '!!./raw-source-loader.cjs!./examples/OneLinearGenomeView.tsx'
import ShadowDOMOneLinearGenomeViewSource from '!!./raw-source-loader.cjs!./examples/ShadowDOMOneLinearGenomeView.tsx'
import UsingLocObjectSource from '!!./raw-source-loader.cjs!./examples/UsingLocObject.tsx'
import WithAggregateTextSearchingSource from '!!./raw-source-loader.cjs!./examples/WithAggregateTextSearching.tsx'
import WithCustomThemeSource from '!!./raw-source-loader.cjs!./examples/WithCustomTheme.tsx'
import WithDarkThemeSource from '!!./raw-source-loader.cjs!./examples/WithDarkTheme.tsx'
import WithDisableZoomAndSideScrollSource from '!!./raw-source-loader.cjs!./examples/WithDisableZoomAndSideScroll.tsx'
import WithErrorHandlerSource from '!!./raw-source-loader.cjs!./examples/WithErrorHandler.tsx'
import WithExternalPluginSource from '!!./raw-source-loader.cjs!./examples/WithExternalPlugin.tsx'
import WithInitSource from '!!./raw-source-loader.cjs!./examples/WithInit.tsx'
import WithInlinePluginsSource from '!!./raw-source-loader.cjs!./examples/WithInlinePlugins.tsx'
import WithInternetAccountsSource from '!!./raw-source-loader.cjs!./examples/WithInternetAccounts.tsx'
import WithObserveVisibleFeaturesSource from '!!./raw-source-loader.cjs!./examples/WithObserveVisibleFeatures.tsx'
import WithObserveVisibleRegionsSource from '!!./raw-source-loader.cjs!./examples/WithObserveVisibleRegions.tsx'
import WithOutsideStylingSource from '!!./raw-source-loader.cjs!./examples/WithOutsideStyling.tsx'
import WithPerTrackTextSearchingSource from '!!./raw-source-loader.cjs!./examples/WithPerTrackTextSearching.tsx'
import WithReact18Source from '!!./raw-source-loader.cjs!./examples/WithReact18.tsx'
import WithShowTrackSource from '!!./raw-source-loader.cjs!./examples/WithShowTrack.tsx'
import WithTwoLinearGenomeViewsSource from '!!./raw-source-loader.cjs!./examples/WithTwoLinearGenomeViews.tsx'
import WithWebWorkerSource from '!!./raw-source-loader.cjs!./examples/WithWebWorker.tsx'

const storyFileOverrides: Record<string, string> = {
  HorizontallyFlippedViaButton: 'HorizontallyFlipped.tsx',
  HorizontallyFlippedViaDisplayedRegions: 'HorizontallyFlipped.tsx',
  HorizontallyFlippedViaLocstring: 'HorizontallyFlipped.tsx',
}

const sourceMap = [
  [DefaultSession, DefaultSessionSource],
  [DisableAddTrack, DisableAddTrackSource],
  [ExternalNavigateLocstring, ExternalNavigateLocstringSource],
  [ExternalNavigateObject, ExternalNavigateObjectSource],
  [HorizontallyFlippedViaButton, HorizontallyFlippedSource],
  [HorizontallyFlippedViaDisplayedRegions, HorizontallyFlippedSource],
  [HorizontallyFlippedViaLocstring, HorizontallyFlippedSource],
  [HumanExomeExample, HumanExomeExampleSource],
  [NextstrainExample, NextstrainExampleSource],
  [OneLinearGenomeView, OneLinearGenomeViewSource],
  [ShadowDOMOneLinearGenomeView, ShadowDOMOneLinearGenomeViewSource],
  [UsingLocObject, UsingLocObjectSource],
  [WithAggregateTextSearching, WithAggregateTextSearchingSource],
  [WithCustomTheme, WithCustomThemeSource],
  [WithDarkTheme, WithDarkThemeSource],
  [WithDisableZoomAndSideScroll, WithDisableZoomAndSideScrollSource],
  [WithErrorHandler, WithErrorHandlerSource],
  [WithExternalPlugin, WithExternalPluginSource],
  [WithInit, WithInitSource],
  [WithInlinePlugins, WithInlinePluginsSource],
  [WithInternetAccounts, WithInternetAccountsSource],
  [WithObserveVisibleFeatures, WithObserveVisibleFeaturesSource],
  [WithObserveVisibleRegions, WithObserveVisibleRegionsSource],
  [WithOutsideStyling, WithOutsideStylingSource],
  [WithPerTrackTextSearching, WithPerTrackTextSearchingSource],
  [WithReact18, WithReact18Source],
  [WithShowTrack, WithShowTrackSource],
  [WithTwoLinearGenomeViews, WithTwoLinearGenomeViewsSource],
  [WithWebWorker, WithWebWorkerSource],
] as const

for (const [story, sourceCode] of sourceMap) {
  const fileName = storyFileOverrides[story.name] ?? `${story.name}.tsx`
  Object.assign(story, {
    parameters: {
      storyFile: fileName,
      docs: { source: { code: sourceCode, language: 'tsx' } },
    },
  })
}

export {
  ShadowDOMOneLinearGenomeView,
  UsingLocObject,
  WithAggregateTextSearching,
  WithCustomTheme,
  WithDarkTheme,
  WithDisableZoomAndSideScroll,
  WithErrorHandler,
  WithExternalPlugin,
  WithInit,
  WithInlinePlugins,
  WithInternetAccounts,
  WithObserveVisibleFeatures,
  WithObserveVisibleRegions,
  WithOutsideStyling,
  WithPerTrackTextSearching,
  WithReact18,
  WithShowTrack,
  WithTwoLinearGenomeViews,
  WithWebWorker,
}

export default { title: 'Source code for examples' }

export {
  DefaultSession,
  DisableAddTrack,
  ExternalNavigateLocstring,
  ExternalNavigateObject,
  HorizontallyFlippedViaButton,
  HorizontallyFlippedViaDisplayedRegions,
  HorizontallyFlippedViaLocstring,
  HumanExomeExample,
  NextstrainExample,
  OneLinearGenomeView,
} from './examples/index.ts'
