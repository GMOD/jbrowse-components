// Claude Desktop stores the initialize response's `instructions` and never
// shows them to the model (anthropics/claude-ai-mcp#93), while Claude Code —
// the client the eval drives — does. This proxy is how the eval measures the
// other client: it spawns the real server, forwards every line untouched, and
// changes exactly two things on the handshake. The model then sees what a
// Claude Desktop user's model sees, and the difference in calls and tokens is
// the cost of the instructions being dropped.
//
// Usage: node desktopClientProxy.ts <path to mcpServer.js> [server args...]
import { spawn } from 'node:child_process'
import readline from 'node:readline'

const [serverPath, ...serverArgs] = process.argv.slice(2)
if (!serverPath) {
  throw new Error('desktopClientProxy needs the path to mcpServer.js')
}

const server = spawn('node', [serverPath, ...serverArgs], {
  stdio: ['pipe', 'pipe', 'inherit'],
})

let initializeId: unknown

function toServer(line: string) {
  try {
    const message = JSON.parse(line) as {
      id?: unknown
      method?: string
      params?: { clientInfo?: { name?: string } }
    }
    if (message.method !== 'initialize') {
      return line
    }
    initializeId = message.id
    if (message.params?.clientInfo) {
      message.params.clientInfo.name = 'claude-desktop-sim'
    }
    return JSON.stringify(message)
  } catch {
    return line
  }
}

function toClient(line: string) {
  try {
    const message = JSON.parse(line) as {
      id?: unknown
      result?: { instructions?: string }
    }
    if (message.id !== initializeId || !message.result) {
      return line
    }
    delete message.result.instructions
    return JSON.stringify(message)
  } catch {
    return line
  }
}

readline
  .createInterface({ input: process.stdin })
  .on('line', line => {
    server.stdin.write(`${toServer(line)}\n`)
  })
  .on('close', () => {
    server.stdin.end()
  })

readline.createInterface({ input: server.stdout }).on('line', line => {
  process.stdout.write(`${toClient(line)}\n`)
})

server.on('close', code => {
  process.exit(code ?? 0)
})
