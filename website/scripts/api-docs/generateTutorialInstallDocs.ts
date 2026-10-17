import fs from 'fs'

import { rewriteGroupedMarkerBlocks } from './util.ts'

// The install fence under a tutorial's `## Prerequisites`, from one registry.
//
// A page names its tools in the marker, `<!-- TUTORIAL_INSTALL samtools,vg
// START -->`, and this writes the commands that install them: apt for
// Debian/Ubuntu, conda (bioconda) for everything it carries, and one line each
// for the language package managers. `tutorialInstall.json` holds a tool's
// package name under each manager that has one, so a rename changes every page
// in one commit. A tool apt lacks but ships as a Linux x86_64 binary also gets
// a wget line; one with no packaged install stays a bullet with a link.
const MANAGERS = ['apt', 'conda', 'cargo', 'pip', 'npm'] as const

type Manager = (typeof MANAGERS)[number]

type Entry = Partial<Record<Manager, string>> & { download?: string[] }

const REGISTRY = JSON.parse(
  fs.readFileSync(new URL('./tutorialInstall.json', import.meta.url), 'utf8'),
) as Record<string, Entry>

const COMMANDS: Record<Manager, string> = {
  apt: 'sudo apt install',
  conda: 'conda install -c bioconda -c conda-forge',
  cargo: 'cargo install',
  pip: 'pip install',
  npm: 'npm install -g',
}

const WIDTH = 78

// One command line, continued with a backslash at the fence's width; a width of
// 0 puts each argument on its own line, for URLs
function wrap(command: string, args: string[], width = WIDTH) {
  const lines: string[] = []
  let line = command
  for (const arg of args) {
    if (line.length + 1 + arg.length > width - 2 && line !== command) {
      lines.push(`${line} \\`)
      line = `  ${arg}`
    } else if (line === command && !width) {
      lines.push(`${line} \\`)
      line = `  ${arg}`
    } else {
      line += ` ${arg}`
    }
  }
  lines.push(line)
  return lines
}

export function renderInstall(tools: string[], where: string) {
  const entries = tools.map(tool => {
    const entry = REGISTRY[tool]
    if (!entry) {
      throw new Error(
        `${where}: TUTORIAL_INSTALL names "${tool}", which is not in tutorialInstall.json`,
      )
    }
    return { tool, entry }
  })
  const packages = (m: Manager) =>
    entries.flatMap(({ entry }) => (entry[m] ? [entry[m]] : []))

  const lines: string[] = []
  const apt = packages('apt')
  const conda = packages('conda')
  if (apt.length) {
    lines.push('# Debian/Ubuntu', ...wrap(COMMANDS.apt, apt))
  }
  if (conda.length) {
    lines.push(
      apt.length ? '# or conda, which has every tool above' : '# conda',
      ...wrap(COMMANDS.conda, conda),
    )
  }
  const urls = entries.flatMap(({ entry }) =>
    entry.download && !entry.apt ? entry.download : [],
  )
  if (urls.length) {
    const names = urls.map(u => u.split('/').pop()!)
    lines.push(
      '# or Linux x86_64 binaries for the tools apt lacks',
      ...wrap('wget -P ~/.local/bin', urls, 0),
      `chmod +x ${names.map(n => `~/.local/bin/${n}`).join(' ')}`,
    )
  }
  const native = (['cargo', 'pip', 'npm'] as const).flatMap(m => {
    const p = packages(m)
    return p.length ? wrap(COMMANDS[m], p) : []
  })
  if (native.length) {
    lines.push(...(lines.length ? ['# any platform'] : []), ...native)
  }
  return `\`\`\`bash\n${lines.join('\n')}\n\`\`\``
}

export function writeTutorialInstallDocs() {
  return rewriteGroupedMarkerBlocks('TUTORIAL_INSTALL', (group, file) =>
    renderInstall(group.split(','), file),
  ).changed
}
