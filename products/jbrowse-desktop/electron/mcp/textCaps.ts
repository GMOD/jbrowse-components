import {
  CLIENT_TEXT_CAP_CHARS,
  MCP_TOOLS,
  SERVER_INSTRUCTIONS,
} from './toolDefinitions.ts'

// Every text a client shows the model before the agent reads a doc, measured
// the way Claude Code measures it: string length in UTF-16 code units, the
// `e.length` its truncation compares against CLIENT_TEXT_CAP_CHARS.
export function clientTexts() {
  return {
    'server instructions': SERVER_INSTRUCTIONS,
    ...Object.fromEntries(
      MCP_TOOLS.map(t => [`tool "${t.name}" description`, t.description]),
    ),
  }
}

export function overCap(cap = CLIENT_TEXT_CAP_CHARS) {
  return Object.entries(clientTexts())
    .filter(([, text]) => text.length > cap)
    .map(([name, text]) => ({ name, length: text.length, cap }))
}
