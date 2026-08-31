import { launchSyntenyView } from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'
import type { SyntenyViewSharedInit } from '@jbrowse/synteny-core'

export interface LaunchDotplotViewArgs extends SyntenyViewSharedInit {
  session: AbstractViewContainer
  // optional explicit view id, so another view in the same session spec can
  // reference this one
  id?: string
  // optional: the extension point receives untrusted runtime spec data, so a
  // malformed spec can omit it — the handler guards and reports a clear error
  views?: {
    assembly: string
    loc?: string
    // per-axis region subset, globs allowed — see DotplotViewInit
    displayedRegionNames?: string[]
  }[]
  tracks?: string[]
  // loc-strings or URL-encoded HighlightType JSON, forwarded to the view's
  // declarative init (see DotplotView init autorun)
  highlight?: string[]
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-DotplotView': {
      args: LaunchDotplotViewArgs
      result: LaunchDotplotViewArgs
    }
  }
}

export default function LaunchDotplotView(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-DotplotView | async | Programmatically launch a dotplot view */
  pluginManager.addToExtensionPoint('LaunchView-DotplotView', args => {
    // Everything but session/id is a view object and forwards verbatim: the
    // view's own preProcessSnapshot sorts the launch keys (views, tracks,
    // highlight, autoDiagonalize) from the properties (colorBy, alpha, …).
    const { session, id, views = [], tracks = [], ...rest } = args
    launchSyntenyView({
      session,
      id,
      viewType: 'DotplotView',
      spec: { views, tracks, ...rest },
    })
    return args
  })
}
