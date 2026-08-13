// Derive the `jbrowse set-default-session` command equivalent to a
// `defaultSession` block.
//
// Unlike add-track, there is nothing to translate into flags: the command takes
// a session file. What the CLI tab is for is the two things a reader otherwise
// has to know — that the command wants the *value* of `defaultSession` rather
// than the object the docs show it inside, and that `--session -` reads stdin,
// which is what lets one pasteable command carry the session with it.
//
// Only a block whose sole top-level key is `defaultSession` is derivable. A
// whole config.json also carries assemblies and tracks the command would not
// write, and a block pairing it with `preConfiguredSessions` carries sessions
// the command silently drops — in both cases a CLI tab would claim to reproduce
// the block and reproduce part of it. scripts/check-config-cli.ts round-trips
// what is emitted through the real CLI.

import { asRecord } from './derive-cli-command.ts'

// The session a `set-default-session` would write, or null when the block is
// not one this command can express on its own.
export function defaultSessionObject(
  config: unknown,
): Record<string, unknown> | null {
  const keys = Object.keys(asRecord(config))
  if (keys.length !== 1 || keys[0] !== 'defaultSession') {
    return null
  }
  const session = asRecord(asRecord(config).defaultSession)
  return Object.keys(session).length > 0 ? session : null
}

// The name the CLI stores when the session file carries none, so the check
// script compares against what the command actually writes rather than against
// the block alone.
export const FALLBACK_SESSION_NAME = 'New Default Session'

/**
 * The session as the block already writes it: the wrapper's opening and closing
 * lines removed and the rest dedented one level.
 *
 * The two tabs sit next to each other, so re-serializing here would show one
 * session in two formattings — prettier's `{ "assembly": "K12" }` on the config
 * side against a re-stringified object three lines tall on the CLI side, for a
 * difference that means nothing. Slicing text out of JSON is only safe if it is
 * checked, so it is: the slice has to parse back to the same session or this
 * returns undefined and the caller re-serializes.
 */
function slicedSession(rawJson: string, session: Record<string, unknown>) {
  const inner = /^\s*\{\s*"defaultSession"\s*:\s*([\s\S]*?),?\s*\}\s*$/.exec(
    rawJson,
  )?.[1]
  if (inner === undefined) {
    return undefined
  }
  const text = inner
    .split('\n')
    .map((line, i) => (i === 0 ? line : line.replace(/^ {1,2}/, '')))
    .join('\n')
  try {
    return JSON.stringify(JSON.parse(text)) === JSON.stringify(session)
      ? text
      : undefined
  } catch {
    return undefined
  }
}

// Exactly what the emitted command feeds the CLI on stdin, so check-config-cli
// can run the heredoc's own body rather than a re-serialization of it that no
// reader is shown.
export function sessionStdin(config: unknown, rawJson: string) {
  const session = defaultSessionObject(config)
  return session === null
    ? null
    : (slicedSession(rawJson, session) ?? JSON.stringify(session, null, 2))
}

export function deriveSetDefaultSession(
  config: unknown,
  rawJson: string,
): string | null {
  const stdin = sessionStdin(config, rawJson)
  return stdin === null
    ? null
    : [`jbrowse set-default-session --session - << 'EOF'`, stdin, 'EOF'].join(
        '\n',
      )
}
