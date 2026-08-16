import { DEFAULT_SHARE_URL } from '@jbrowse/app-core'
import { encodeSessionParam, fetchJson } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import {
  DEFAULT_WEB_BASE_URL,
  bakeSessionCascades,
  buildWebExportUrl,
  planWebExport,
} from '@jbrowse/product-core'

import packageJSON from '../../package.json' with { type: 'json' }

import type { AbstractSessionModel, SessionShareMode } from '@jbrowse/core/util'
import type {
  HostedBaseConfig,
  WebExportInput,
  WebExportPlan,
} from '@jbrowse/product-core'

// The desktop counterpart of jbrowse-web's buildShareUrl: everything between a
// saved desktop snapshot and a jbrowse-web URL, kept out of ExportToWebDialog so
// the dialog is only the UI around it.
//
// Split in two because only the second half depends on the share mode. The
// dialog runs `prepareExport` once and `buildLink` per mode, so switching modes
// doesn't re-fetch the hosted base config or re-read the live session.

export interface PreparedExport {
  plan: WebExportPlan
  // plan.session with the live promotable-default cascade flattened in
  bakedSession: Record<string, unknown>
  // the share store a short link must upload to, see below
  shareURL: string
}

export async function prepareExport(
  snapshot: WebExportInput,
  session: AbstractSessionModel,
): Promise<PreparedExport> {
  const sourceConfigUrl = snapshot.configuration?.sourceConfigUrl
  // If the hosted base config can't be fetched (hub down, offline), fall back
  // to a self-contained export rather than failing the whole operation —
  // planWebExport treats a missing baseConfig as "no usable base".
  const baseConfig = sourceConfigUrl
    ? await fetchJson<HostedBaseConfig>(sourceConfigUrl).catch((e: unknown) => {
        console.error(e)
        return undefined
      })
    : undefined
  if (baseConfig && sourceConfigUrl) {
    // Stamp baseUri onto the base's relative-URI locations the same way desktop
    // did when it first loaded this config (see fetchConfig), so planWebExport's
    // per-track diff against the base doesn't read every relative-URI location as
    // an edit.
    addRelativeUris(baseConfig, new URL(sourceConfigUrl))
  }
  const plan = planWebExport(snapshot, baseConfig)
  return {
    plan,
    // Flatten the cascades this desktop instance resolves at read time, the same
    // as jbrowse-web's ShareDialog — promoted display-type defaults into each
    // track's config layer (self-contained track into its sessionTracks config,
    // hosted-base track into a trackConfigDeltas entry the web recipient merges),
    // and the workspaces intent — so the exported session shows what the sender
    // saw. Not `getShareableSessionSnapshot`, because the snapshot being baked is
    // planWebExport's transformed one rather than the live session's.
    bakedSession: bakeSessionCascades(session, plan.session),
    // A short link uploads to the share server that the export TARGET reads back
    // from — never this desktop instance's own shareURL config, since Desktop never
    // reads share links at all. That target is DEFAULT_WEB_BASE_URL loading
    // `?config=<plan.configUrl>`, and jbrowse-web resolves the store from *that
    // config's* configuration.shareURL (SessionLoader.fetchSharedSession). So a
    // hosted base declaring its own share server has to win here, or the link
    // resolves against a store the session was never uploaded to. With no hosted
    // base (self-contained, `?config=none`) web falls back to DEFAULT_SHARE_URL, and
    // the two defaults are a pair.
    shareURL:
      plan.strategy === 'hostedConfigBase'
        ? // mirrors web's readConf: an explicit empty string is honored as-is
          (baseConfig?.configuration?.shareURL ?? DEFAULT_SHARE_URL)
        : DEFAULT_SHARE_URL,
  }
}

export async function buildLink(
  prepared: PreparedExport,
  mode: SessionShareMode,
) {
  const { plan, bakedSession, shareURL } = prepared
  const { sessionParam, password, plaintext } = await encodeSessionParam(
    mode,
    bakedSession,
    { shareURL, referer: DEFAULT_WEB_BASE_URL },
  )
  return {
    url: buildWebExportUrl(plan, sessionParam, {
      password,
      // what made this link, since nothing else in it is pinned — see
      // buildWebExportUrl
      exportedFrom: `jbrowse-desktop@${packageJSON.version}`,
    }),
    plaintext,
  }
}
