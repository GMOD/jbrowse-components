import fs from 'node:fs'

const { questions, events } = JSON.parse(fs.readFileSync(process.argv[2]))
let turn = -1
for (const ev of events) {
  if (ev.type === 'assistant') {
    for (const b of ev.message?.content ?? []) {
      if (b.type === 'text' && b.text.trim()) {
        console.log(`  TEXT: ${b.text.trim().replaceAll(/\s+/g, ' ')}`)
      }
      if (b.type === 'tool_use') {
        const arg = String(
          b.input?.code ?? b.input?.target ?? b.input?.topic ?? '',
        )
          .trim()
          .replaceAll(/\s+/g, ' ')
        console.log(
          `  -> ${b.name.replace('mcp__jbrowse__', '')} ${arg.slice(0, 260)}`,
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
