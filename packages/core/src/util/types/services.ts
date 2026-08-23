import type { RpcCallArgs, RpcCallReturn } from '../../rpc/RpcRegistry.ts'
import type { JBrowsePalette } from '../../ui/palette.ts'
import type { SerializableThemeArgs } from '../../ui/theme.ts'
import type React from 'react'

// What a display asks of its host, named one service at a time.
// `AbstractSessionModel` in `./index.ts` extends every interface here, so a
// session satisfies them all and nothing that already works changes type; the
// point of the split is the other direction. A module that only issues RPCs
// takes an `RpcHost` and its type graph stops at the RPC registry, where taking
// a whole session put `PluginManager`, the configuration schemas and every
// widget in it — see `agent-docs/ideas/lightweight-toolkit.md` §2 and
// `scripts/moduleClosure.ts` for the number.
//
// Nothing app-shaped may be imported here. `AssemblyManager` is the service
// that cannot meet that bar — it is an MST model built by a `PluginManager` —
// so it lives one file over in `./renderingServices.ts` and only its callers
// pay for it.

/**
 * The one thing a fetch needs of an RPC manager: the registry-typed call. A
 * real {@link RpcManager} satisfies it, and so does a host that routes RPCs
 * somewhere else entirely.
 */
export interface RpcCaller {
  call<M extends string>(
    sessionId: string,
    method: M,
    args: RpcCallArgs<M>,
  ): Promise<RpcCallReturn<M>>
}

export interface RpcHost {
  rpcManager: RpcCaller
}

/**
 * The colors a renderer draws with. `palette` is plain data — no toolkit, and
 * serializable, so a worker baking labels reads the same values the React
 * chrome does. `themeOptions` is what rebuilds it on the far side of an RPC.
 */
export interface PaletteHost {
  palette: JBrowsePalette
  themeOptions?: SerializableThemeArgs
}

export type NotificationLevel = 'error' | 'info' | 'warning' | 'success'

export interface SnackAction {
  name: React.ReactElement | string
  onClick: () => void
}

/** where a display puts a message it cannot draw itself */
export interface NotificationSink {
  notify: (
    message: string,
    level?: NotificationLevel,
    // `SnackbarModel.notify` has always normalized an array here; this
    // declaration said singular, so the one caller that needs to offer a
    // choice (the promoted-default pin's two scopes) could not say so without
    // a cast. Widening, so every existing single-action caller still fits.
    action?: SnackAction | SnackAction[],
  ) => void
  notifyError: (
    message: string,
    error?: unknown,
    extra?: unknown,
    action?: SnackAction,
  ) => void
}

export type DialogComponentType =
  | React.LazyExoticComponent<React.FC<any>>
  | React.FC<any>

/**
 * The single member a host has to implement to be somewhere a display can put a
 * dialog. It is the most-called session member from plugin code (49 sites), and
 * nearly all of them are a display saying "the user wants to configure
 * something" — so a host drawing its own UI needs exactly this one name, not a
 * session. `agent-docs/ideas/lightweight-toolkit.md` §3.
 */
export interface DialogHost {
  DialogComponent?: DialogComponentType
  DialogProps: Record<string, unknown> | undefined
  queueDialog<T extends DialogComponentType>(
    callback: (doneCallback: () => void) => [T, React.ComponentProps<T>],
  ): void
}

/** everything a session offers that costs nothing app-shaped to name */
export interface SessionServices
  extends RpcHost, PaletteHost, NotificationSink, DialogHost {}

/**
 * The one runtime test behind both this and `isSessionModel`: they differ only
 * in how much of the thing they let the caller see.
 */
export function isSessionServices(thing: unknown): thing is SessionServices {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'rpcManager' in thing &&
    'configuration' in thing
  )
}
