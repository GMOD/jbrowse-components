// Runs every tutorial's "Reproduce it end to end" build the way a reader does,
// against this tree's scripts and JBrowse CLI, then validates each config.json
// it writes. A failure here is one a reader following the page hits too.
//
// Each page's run is the first `bash <script>.sh` line per script in that
// section's fences; later lines are alternatives (another cohort, the whole
// genome). Heavy and network-bound, so it runs on ada, not the laptop.
//
// `--cli released` runs the scripts on the published `@jbrowse/cli@next`, as a
// reader's copy does, so a fix that is on main but unreleased still fails there.
//
// Run: `pnpm --filter @jbrowse/cli build`, then
//      node scripts/run-tutorial-builds.ts [--only a,b] [--jobs 2]
//        [--timeout 120] [--out dir] [--list] [--clean] [--min-free-gb 150]
//        [--cli main|released] [--env <prefix>]
//
// `--clean` deletes each run's files after it finishes, keeping run.log.
//
// `--env` puts a tool environment's bin first on PATH, the one
// scripts/tutorial-tools-env.ts builds from the tutorials' install registry.

import { spawn, spawnSync } from 'node:child_process'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

const repo = path.resolve(import.meta.dirname, '..')
const tutorialsDir = path.join(repo, 'website', 'docs', 'tutorials')
const cliBin = path.join(repo, 'products', 'jbrowse-cli', 'dist', 'bin.js')

const NEEDS_READER_INPUT: Record<string, string> = {
  'build_odp_linkage_groups_synteny.sh':
    'reads a Dryad archive the reader downloads by hand',
  'build_protein_domains.sh': "takes the reader's genome.fa and genes.gff3",
  'build_repeatmasker_classes.sh':
    "takes the reader's genome.fa and RepeatMasker .out",
}

interface Run {
  id: string
  script: string
  args: string[]
  env: Record<string, string>
  pages: string[]
}

interface RunOptions {
  outRoot: string
  timeoutMs: number
  clean: boolean
  jbrowseCli: string
  pathPrefix: string
}

interface Result {
  id: string
  script: string
  command: string
  pages: string[]
  status:
    | 'pass'
    | 'fail'
    | 'timeout'
    | 'missing-tool'
    | 'missing-script'
    | 'invalid-config'
    | 'skipped'
  detail: string
  seconds: number
  bytes: number
  configs: string[]
}

const ENV_ASSIGNMENT = /^(\w+)=("[^"]*"|'[^']*'|\S+)\s+/
const BASH_LINE = /^bash\s+(\S+\.sh)\b(.*)$/

function reproduceFenceLines(markdown: string) {
  const section =
    /^## Reproduce it end to end\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(
      markdown,
    )?.[1]
  return section
    ? [...section.matchAll(/^```(?:bash|sh)\n([\s\S]*?)^```/gm)].flatMap(m =>
        m[1]!.split('\n'),
      )
    : []
}

function parseRunLine(line: string) {
  let rest = line.replace(/\s+#.*$/, '').trim()
  const env: Record<string, string> = {}
  let assignment = ENV_ASSIGNMENT.exec(rest)
  while (assignment) {
    env[assignment[1]!] = assignment[2]!.replaceAll(/^["']|["']$/g, '')
    rest = rest.slice(assignment[0].length)
    assignment = ENV_ASSIGNMENT.exec(rest)
  }
  const match = BASH_LINE.exec(rest)
  return match
    ? {
        script: path.basename(match[1]!),
        args: match[2]!.trim().split(/\s+/).filter(Boolean),
        env,
      }
    : undefined
}

function collectRuns() {
  const runs = new Map<string, Run>()
  for (const file of readdirSync(tutorialsDir).filter(f => f.endsWith('.md'))) {
    const page = file.replace(/\.md$/, '')
    const seen = new Set<string>()
    for (const line of reproduceFenceLines(
      readFileSync(path.join(tutorialsDir, file), 'utf8'),
    )) {
      const parsed = parseRunLine(line)
      if (parsed && !seen.has(parsed.script)) {
        seen.add(parsed.script)
        const id = [parsed.script.replace(/\.sh$/, ''), ...parsed.args]
          .join('_')
          .replaceAll(/[^\w.-]+/g, '_')
        const run = runs.get(id) ?? { id, ...parsed, pages: [] }
        run.pages.push(page)
        runs.set(id, run)
      }
    }
  }
  return [...runs.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'))
}

function commandText(run: Run) {
  return [
    ...Object.entries(run.env).map(([k, v]) => `${k}=${v}`),
    'bash',
    run.script,
    ...run.args,
  ].join(' ')
}

function findConfigs(dir: string, depth = 0): string[] {
  return depth > 4 || !existsSync(dir)
    ? []
    : readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() &&
        !['node_modules', 'static', 'test_data'].includes(entry.name)
          ? findConfigs(path.join(dir, entry.name), depth + 1)
          : entry.isFile() && entry.name === 'config.json'
            ? [path.join(dir, entry.name)]
            : [],
      )
}

function diskBytes(dir: string) {
  const out = spawnSync('du', ['-sb', dir], { encoding: 'utf8' }).stdout
  return Number.parseInt(out.split('\t')[0] ?? '0', 10) || 0
}

function logTail(logFile: string, lines: number) {
  return readFileSync(logFile, 'utf8')
    .trimEnd()
    .split('\n')
    .slice(-lines)
    .join('\n')
}

function execute(run: Run, runDir: string, options: RunOptions) {
  const logFile = path.join(runDir, 'run.log')
  const log = createWriteStream(logFile)
  const started = Date.now()
  const child = spawn(
    'bash',
    [path.join(repo, 'scripts', run.script), ...run.args],
    {
      cwd: runDir,
      env: {
        ...process.env,
        ...run.env,
        PATH: `${options.pathPrefix}${process.env.PATH}`,
        JBROWSE_CLI: options.jbrowseCli,
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    process.kill(-child.pid!, 'SIGKILL')
  }, options.timeoutMs)
  return new Promise<{
    code: number | null
    timedOut: boolean
    seconds: number
    logFile: string
  }>(resolve => {
    child.on('close', code => {
      clearTimeout(timer)
      log.end(() => {
        resolve({
          code,
          timedOut,
          seconds: Math.round((Date.now() - started) / 1000),
          logFile,
        })
      })
    })
  })
}

function validate(config: string) {
  const out = spawnSync(
    process.execPath,
    [cliBin, 'validate', config, '--quiet'],
    {
      encoding: 'utf8',
    },
  )
  return { ok: out.status === 0, output: `${out.stdout}${out.stderr}`.trim() }
}

async function runOne(run: Run, options: RunOptions) {
  const { outRoot, clean } = options
  const base = {
    id: run.id,
    script: run.script,
    command: commandText(run),
    pages: run.pages,
    seconds: 0,
    bytes: 0,
    configs: [],
  }
  const reason = NEEDS_READER_INPUT[run.script]
  if (reason) {
    return { ...base, status: 'skipped', detail: reason } satisfies Result
  }
  if (!existsSync(path.join(repo, 'scripts', run.script))) {
    return {
      ...base,
      status: 'missing-script',
      detail: `scripts/${run.script} does not exist`,
    } satisfies Result
  }
  const runDir = path.join(outRoot, run.id)
  rmSync(runDir, { recursive: true, force: true })
  mkdirSync(runDir, { recursive: true })
  const { code, timedOut, seconds, logFile } = await execute(
    run,
    runDir,
    options,
  )
  const tail = logTail(logFile, 25)
  const missingTool = /error: '([^']+)' not found on PATH/.exec(tail)?.[1]
  const configs = findConfigs(runDir)
  const invalid = configs
    .map(config => ({ config, ...validate(config) }))
    .filter(v => !v.ok)
  const status: Result['status'] = timedOut
    ? 'timeout'
    : code !== 0
      ? missingTool
        ? 'missing-tool'
        : 'fail'
      : invalid.length > 0
        ? 'invalid-config'
        : 'pass'
  const detail =
    status === 'missing-tool'
      ? missingTool!
      : status === 'invalid-config'
        ? invalid
            .map(
              v =>
                `${path.relative(runDir, v.config)}: ${v.output
                  .split('\n')
                  .filter(l => l.startsWith('error:'))
                  .join('; ')}`,
            )
            .join('\n')
        : status === 'pass'
          ? ''
          : tail
  const bytes = diskBytes(runDir)
  if (clean) {
    for (const entry of readdirSync(runDir)) {
      if (entry !== 'run.log') {
        rmSync(path.join(runDir, entry), { recursive: true, force: true })
      }
    }
  }
  return {
    ...base,
    status,
    detail,
    seconds,
    bytes,
    configs: configs.map(c => path.relative(outRoot, c)),
  } satisfies Result
}

function humanBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exp = Math.min(
    Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)),
    4,
  )
  return `${(bytes / 1024 ** exp).toFixed(exp ? 1 : 0)} ${units[exp]}`
}

function summary(results: Result[], outRoot: string, jbrowseCli: string) {
  const order: Result['status'][] = [
    'fail',
    'invalid-config',
    'timeout',
    'missing-script',
    'missing-tool',
    'skipped',
    'pass',
  ]
  const sorted = results.toSorted(
    (a, b) =>
      order.indexOf(a.status) - order.indexOf(b.status) ||
      a.id.localeCompare(b.id, 'en'),
  )
  const counts = order
    .map(s => [s, results.filter(r => r.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(', ')
  return [
    `# Tutorial builds, ${new Date().toISOString()}`,
    '',
    `CLI: \`${jbrowseCli}\`. Output: ${outRoot}. ${counts}.`,
    '',
    '| Status | Run | Pages | Time | Disk | Detail |',
    '| --- | --- | --- | --- | --- | --- |',
    ...sorted.map(r =>
      [
        '',
        r.status,
        `\`${r.command}\``,
        r.pages.join(', '),
        `${Math.round(r.seconds / 60)} min`,
        humanBytes(r.bytes),
        (r.detail.split('\n').findLast(l => l.trim()) ?? '')
          .replaceAll('|', '\\|')
          .slice(0, 160),
        '',
      ]
        .join(' | ')
        .trim(),
    ),
    '',
  ].join('\n')
}

async function main() {
  const { values } = parseArgs({
    options: {
      only: { type: 'string' },
      jobs: { type: 'string', default: '2' },
      timeout: { type: 'string', default: '120' },
      out: {
        type: 'string',
        default: path.join(
          os.homedir(),
          'tutorial-runs',
          new Date().toISOString().replaceAll(/[:.]/g, '-'),
        ),
      },
      list: { type: 'boolean' },
      clean: { type: 'boolean' },
      'min-free-gb': { type: 'string', default: '150' },
      cli: { type: 'string', default: 'main' },
      env: { type: 'string' },
    },
  })
  const only = values.only?.split(',').map(s => s.trim().replace(/\.sh$/, ''))
  const runs = collectRuns().filter(
    run =>
      !only ||
      only.some(
        o => run.script === `${o}.sh` || run.pages.includes(o) || run.id === o,
      ),
  )
  if (values.list) {
    for (const run of runs) {
      console.log(`${commandText(run).padEnd(60)} ${run.pages.join(', ')}`)
    }
    return
  }
  if (!existsSync(cliBin)) {
    throw new Error(
      `${cliBin} is missing; run pnpm --filter @jbrowse/cli build first`,
    )
  }
  if (values.cli !== 'main' && values.cli !== 'released') {
    throw new Error(`--cli is main or released, not ${values.cli}`)
  }
  const outRoot = path.resolve(values.out)
  mkdirSync(outRoot, { recursive: true })
  const options: RunOptions = {
    outRoot,
    timeoutMs: Number(values.timeout) * 60_000,
    clean: values.clean ?? false,
    jbrowseCli:
      values.cli === 'main' ? `node ${cliBin}` : 'npx -y @jbrowse/cli@next',
    pathPrefix: values.env
      ? `${path.join(path.resolve(values.env), 'bin')}${path.delimiter}`
      : '',
  }
  const queue = [...runs]
  const results: Result[] = []
  const freeGb = () => {
    const { bavail, bsize } = statfsSync(outRoot)
    return (bavail * bsize) / 1024 ** 3
  }
  const worker = async () => {
    for (let run = queue.shift(); run; run = queue.shift()) {
      if (freeGb() < Number(values['min-free-gb'])) {
        console.log(
          `stopping: ${Math.round(freeGb())} GB free, under --min-free-gb; ${queue.length + 1} runs not started`,
        )
        queue.length = 0
        break
      }
      const result = await runOne(run, options)
      results.push(result)
      console.log(
        `${result.status.padEnd(14)} ${String(result.seconds).padStart(6)}s  ${result.command}`,
      )
      writeFileSync(
        path.join(outRoot, 'results.json'),
        JSON.stringify(results, null, 2),
      )
    }
  }
  await Promise.all(Array.from({ length: Number(values.jobs) }, worker))
  const report = summary(results, outRoot, options.jbrowseCli)
  writeFileSync(path.join(outRoot, 'summary.md'), report)
  console.log(`\n${report}`)
  process.exitCode = results.some(r => !['pass', 'skipped'].includes(r.status))
    ? 1
    : 0
}

await main()
