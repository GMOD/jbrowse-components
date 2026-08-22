import { lazy } from 'react'

/**
 * The forms and prompts the internet accounts ask the user for a credential
 * with, behind their own chunks.
 *
 * An internet account's state model is registered when the plugin installs, and
 * each of these models named its form at module scope — so every host shipped
 * the form, `SubmitDialog` and the MUI text-field/dialog graph behind them
 * before anything could possibly have asked for a credential. Most sessions
 * never authenticate at all. See `agent-docs/reference/EAGER_BUNDLE.md`.
 *
 * `getTokenFromUser` passes the form to `session.queueDialog`, and `DialogQueue`
 * renders it inside a `Suspense` boundary, so lazy needs nothing at the call
 * site. All are named exports, hence the `.then` — `lazy` wants a module
 * with a `default`.
 */
export const HTTPBasicLoginForm = lazy(() =>
  import('./HTTPBasicModel/HTTPBasicLoginForm.tsx').then(m => ({
    default: m.HTTPBasicLoginForm,
  })),
)

export const ExternalTokenEntryForm = lazy(() =>
  import('./ExternalTokenModel/ExternalTokenEntryForm.tsx').then(m => ({
    default: m.ExternalTokenEntryForm,
  })),
)

export const OAuthLoginPrompt = lazy(() =>
  import('./OAuthModel/OAuthLoginPrompt.tsx').then(m => ({
    default: m.OAuthLoginPrompt,
  })),
)
