import {
  createJbApi,
  ensureReExports,
  safeJson,
  sessionOf,
  waitReady,
} from '@jbrowse/app-core'

import type { McpBridgeRequest } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'

// The raw primitive under all of the above: Claude-authored code against the
// live model graph. The renderer already runs with nodeIntegration and the
// bridge socket is user-only, so this grants what the surface as a whole
// already grants — expressed directly instead of through a curated verb.
//
// What the code is given — the `jb` standard library — lives in
// @jbrowse/app-core, because jbrowse-web publishes the same object as
// `window.jb`. Only the calling convention and the response envelope are here.
async function evaluate(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  await ensureReExports()
  const code = typeof args.code === 'string' ? args.code : ''
  if (!code) {
    throw new Error('run_javascript needs code (an async function body)')
  }
  const maxBytes = typeof args.maxBytes === 'number' ? args.maxBytes : 50_000
  const jb = createJbApi(pluginManager)
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(
    'session',
    'rootModel',
    'pluginManager',
    'jb',
    `return (async () => {\n${code}\n})()`,
  ) as (
    session: AbstractSessionModel,
    rootModel: unknown,
    pluginManager: PluginManager,
    jbHelpers: typeof jb,
  ) => Promise<unknown>
  const value = await fn(session, pluginManager.rootModel, pluginManager, jb)
  if (value === undefined) {
    return { note: 'code returned undefined — use "return" for a value' }
  }
  // Past V8's maximum string, JSON.stringify throws RangeError("Invalid string
  // length") rather than returning something long — so the truncation below
  // never gets the chance to help with the case it exists for, and the caller
  // is told about string lengths when what it did was return a live object.
  let json
  try {
    json = safeJson(value)
  } catch (e) {
    throw new Error(
      `the returned value could not be serialized (${e instanceof Error ? e.message : String(e)}). A live model node or a rendering backend serializes its whole object graph — return a summary you built from it instead of the object.`,
      { cause: e },
    )
  }
  return json.length <= maxBytes
    ? { bytes: json.length, value: JSON.parse(json) as unknown }
    : {
        bytes: json.length,
        note: `result larger than maxBytes=${maxBytes} — truncated preview follows; aggregate in code or raise maxBytes`,
        preview: json.slice(0, maxBytes),
      }
}

export async function handleMcpRequest(
  request: McpBridgeRequest,
  pluginManager: PluginManager | undefined,
): Promise<unknown> {
  const { tool, args } = request
  const session = sessionOf(pluginManager)
  if (tool === 'wait_ready') {
    return session
      ? waitReady(
          typeof args.timeoutMs === 'number' ? args.timeoutMs : 30_000,
          session,
        )
      : { settled: true, note: 'no session is open (start screen)' }
  }
  if (!pluginManager || !session) {
    throw new Error(
      'No session is open. Use the open tool with a config/session file or URL, or bare to list recent sessions.',
    )
  }
  if (tool === 'run_javascript') {
    return evaluate(pluginManager, session, args)
  }
  throw new Error(`Unknown tool: ${tool} — use run_javascript`)
}
