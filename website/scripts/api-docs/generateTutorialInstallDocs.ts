import fs from 'fs'

import { rewriteGroupedMarkerBlocks } from './util.ts'

// The install fence under a tutorial's `## Prerequisites`, from one registry.
//
// A page names its tools in the marker, `<!-- TUTORIAL_INSTALL samtools,vg
// START -->`, and this writes the commands that install them: apt for
// Debian/Ubuntu, conda (bioconda) for everything it carries, and one line each
// for the language package managers. `tutorialInstall.json` holds a tool's
// package name under each manager that has one, so a rename changes every page
// in one commit. A tool with no packaged install stays a bullet with a link.
const MANAGERS = ['apt', 'conda', 'cargo', 'pip', 'npm'] as const

type Manager = (typeof MANAGERS)[number]

const REGISTRY = JSON.parse(
  fs.readFileSync(new URL('./tutorialInstall.json', import.meta.url), 'utf8'),
) as Record<string, Partial<Record<Manager, string>>>

const COMMANDS: Record<Manager, string> = {
  apt: 'sudo apt install',
  conda: 'conda install -c bioconda -c conda-forge',
  cargo: 'cargo install',
  pip: 'pip install',
  npm: 'npm install -g',
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
    lines.push('# Debian/Ubuntu', `${COMMANDS.apt} ${apt.join(' ')}`)
  }
  if (conda.length) {
    const aptLacks = entries
      .filter(({ entry }) => entry.conda && !entry.apt)
      .map(({ tool }) => tool)
    const heading = !apt.length
      ? '# conda'
      : aptLacks.length
        ? `# or conda, which also has ${aptLacks.join(', ')}`
        : '# or conda'
    lines.push(heading, `${COMMANDS.conda} ${conda.join(' ')}`)
  }
  for (const m of ['cargo', 'pip', 'npm'] as const) {
    const p = packages(m)
    if (p.length) {
      lines.push(`${COMMANDS[m]} ${p.join(' ')}`)
    }
  }
  return `\`\`\`bash\n${lines.join('\n')}\n\`\`\``
}

export function writeTutorialInstallDocs() {
  return rewriteGroupedMarkerBlocks('TUTORIAL_INSTALL', (group, file) =>
    renderInstall(group.split(','), file),
  ).changed
}
