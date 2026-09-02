import fs from 'node:fs'

const { questions, system, events } = JSON.parse(
  fs.readFileSync(process.argv[2]),
)
if (system) {
  console.log(`SYSTEM: ${system.trim().replaceAll(/\s+/g, ' ')}\n`)
}
let turn = -1
for (const ev of events) {
  if (ev.type === 'assistant') {
    for (const b of ev.message?.content ?? []) {
      if (b.type === 'text' && b.text.trim()) {
        console.log(`  TEXT: ${b.text.trim().replaceAll(/\s+/g, ' ')}`)
      }
      if (b.type === 'tool_use') {
        const arg = String(
          b.input?.code ??
            b.input?.command ??
            b.input?.file_path ??
            b.input?.text ??
            b.input?.target ??
            b.input?.topic ??
            b.input?.url ??
            '',
        )
          .trim()
          .replaceAll(/\s+/g, ' ')
        console.log(
          `  -> ${b.name.replace(/^mcp__[\w-]+?__/, '')} ${arg.slice(0, 260)}`,
        )
      }
    }
  }
  if (ev.type === 'result') {
    turn++
    console.log(
      `\n===== turn ${turn} done in ${(ev.duration_ms / 1000).toFixed(0)}s =====\n=== NEXT: ${questions[turn + 1] ?? '(end)'}\n`,
    )
  }
}
