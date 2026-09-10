import readline from 'node:readline'

/**
 * One line-delimited JSON channel, which is what every hop of this surface
 * speaks: the MCP client over stdio, the stdio server to the bridge socket, and
 * the bridge answering back. Three readers and two writers had a copy each, and
 * both of the lessons below were learnt at one of them and not the others.
 */

export type JsonLine =
  | { value: Record<string, unknown> }
  // JSON.parse threw. A killed peer can leave a truncated final line — a
  // screenshot is one multi-MB line — which must fail that call, not the reader.
  | { dropped: 'unparseable' }
  // JSON.parse accepts `null` and arrays, and nothing off a socket is trusted.
  | { dropped: 'not-an-object' }

/**
 * Read whole JSON objects off a stream, one per line.
 *
 * Both error listeners, or the process dies. A peer that exits mid-call leaves
 * a half-closed pipe: the next write fails EPIPE and the stream emits 'error' —
 * and readline forwards its input's errors to the Interface, which has no
 * listener of its own and throws. On the bridge that is the main process, and
 * it takes the user's unsaved session with it.
 */
export function onJsonLines(
  input: NodeJS.ReadableStream,
  handle: (line: JsonLine) => void,
) {
  const rl = readline.createInterface({ input })
  input.on('error', () => {})
  rl.on('error', () => {})
  rl.on('line', line => {
    if (!line.trim()) {
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      handle({ dropped: 'unparseable' })
      return
    }
    handle(
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? { value: parsed as Record<string, unknown> }
        : { dropped: 'not-an-object' },
    )
  })
  return rl
}

/**
 * Write one object as a line, or nothing if the peer has gone.
 *
 * `writable`, not `!destroyed`: a peer that has exited leaves the socket alive
 * and unwritable for a tick, and that tick is where the EPIPE above comes from.
 */
export function writeJsonLine(output: NodeJS.WritableStream, value: unknown) {
  if (output.writable) {
    output.write(`${JSON.stringify(value)}\n`)
  }
}
