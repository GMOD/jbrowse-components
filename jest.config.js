import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// availableParallelism() honours the CPU affinity mask, so a run already pinned
// to a subset of cores (taskset, a container's cpuset) sizes itself to what it
// was actually given. os.cpus().length reports every core on the box regardless.
const cpuCount = os.availableParallelism?.() ?? os.cpus().length

// What the kernel says can be handed out without swapping — page cache counted
// as reclaimable, which `os.freemem()` does not do. On a box with 13GB of cache
// freemem reads 6GB while MemAvailable reads 19GB, and sizing off the first
// pins every run to one worker on a machine that is not busy at all.
function availableGb() {
  try {
    const kb = /MemAvailable:\s+(\d+) kB/.exec(
      fs.readFileSync('/proc/meminfo', 'utf8'),
    )?.[1]
    if (kb) {
      return Number(kb) / 1024 / 1024
    }
  } catch {
    // not Linux, or /proc unreadable
  }
  return os.freemem() / 1024 ** 3
}

// Worker budget, most specific wins.
//
// The tiers used to be flat numbers — 1 for an agent, 4 for a human — and the
// flat 1 was the expensive one: measured whole-suite on a quiet 16-core box,
// warm cache, `pnpm test` runs 372s at 4 workers and 262s at 8, while the same
// work serialised through one worker is the 1440s those runs sum to. The reason
// it was flat is real and has not gone away (several agent worktrees each size
// themselves as though alone, so the machine-wide total is per-run budget times
// however many agents), but a per-run budget CAN see the machine — through
// memory and load, below — where it cannot see the other agents directly.
function resolveMaxWorkers() {
  // 1. Explicit override, for the run that genuinely wants the whole box.
  //    `JEST_MAX_WORKERS=12 pnpm test <dir>`. Ignored unless it parses to >0, so
  //    a stray empty or garbage value falls through instead of pinning to NaN.
  const override = Number(process.env.JEST_MAX_WORKERS)
  if (Number.isInteger(override) && override > 0) {
    return override
  }

  // 2. The ceiling. Past 8 the box stops paying. Whole suite on 16 cores, warm,
  //    quiet: 322s at 4, 216s at 8, 197s at 12, 199s at 16 — so the last
  //    doubling is worth nothing at all, and the 12 that does buy 9% holds
  //    18.5GB against 8's 12.5GB (16 holds 26GB of the box's 30). Workers stay
  //    ~97% occupied throughout; what stops scaling is the per-suite cost under
  //    contention, so past the knee a run is fast only by taking the machine off
  //    everything else.
  //
  //    Claude Code exports CLAUDECODE=1 into every command it runs and it is in
  //    no shell profile here, so it marks agent runs and only agent runs. An
  //    agent gets the lower ceiling because several sessions overlap by
  //    construction; a human at a terminal is one run.
  const ceiling = process.env.CLAUDECODE
    ? Math.min(4, Math.max(1, Math.floor(cpuCount / 4)))
    : Math.min(8, Math.max(2, Math.floor(cpuCount / 2)))

  // 3. Then hand back whatever the machine cannot currently afford. A worker
  //    peaked at ~1.3GB in the 16-worker run, so 1.6GB apiece is the budget
  //    with room for the main process. This one applies to every run — it is
  //    the guard against swapping, and swapping is slower than any worker count
  //    is fast. It never binds on CI, where 16GB over 1.6 is well past the
  //    ceiling 4 CPUs allow.
  const byMemory = Math.floor(availableGb() / 1.6)

  // Load, on the other hand, is the multi-agent fairness knob and applies to
  // agent runs ONLY. It reads state the other sessions create — nothing here
  // can see them, but their workers are in the load average — so fourteen
  // concurrent sessions drive it to the floor of 1, which is what the flat tier
  // used to hard-code. Two runs it must NOT reach: a human at a terminal, who
  // gets the machine undiluted (the position `scripts/heavy-run-slot.sh` takes
  // for typechecks, for the same reason), and CI, where `pnpm install` has just
  // finished and left a load average that would read as a busy box and cut a
  // 4-CPU runner to one worker.
  const byLoad = process.env.CLAUDECODE
    ? Math.floor(cpuCount - os.loadavg()[0])
    : ceiling

  return Math.max(1, Math.min(ceiling, byMemory, byLoad))
}

// Transform-cache home. Entries are content-addressed by
// `config/jest/babelTransform.cjs` — no absolute path is in the key — so every
// worktree can read the one the primary checkout has already filled instead of
// re-transpiling the whole graph on its first run. That cold prefix is minutes
// per worktree, and `EnterWorktree` is the normal way to start work here.
//
// Off /tmp deliberately, which is where jest defaults (`/tmp/jest_<uid>`): /tmp
// is tmpfs on Linux dev boxes, so the ~1.4GB cache would sit in RAM competing
// with the workers and be lost on every reboot. On disk it survives reboots and
// CI restores it between runs (push.yml, which names this path).
//
// Only the transform cache is shared. jest's other artifacts in here — the
// haste map, the per-run timing cache — carry a hash of the resolved config,
// rootDir included, in their filenames, so two checkouts never collide.
const rootDir = path.dirname(fileURLToPath(import.meta.url))
const primaryCheckout =
  /^(?<primary>.*)\/\.claude\/worktrees\/[^/]+$/.exec(rootDir)?.groups
    ?.primary ?? rootDir
const cacheDirectory = path.join(primaryCheckout, 'node_modules/.cache/jest')

const baseConfig = {
  // Cache warmth is the single biggest lever on jest startup here: transpiling
  // the plugin graph costs a serial prefix before any test body runs, measured
  // repeatedly at ~19-26s cold vs ~5-7s warm for one trivial suite. Where the
  // directory is and why it is shared: the `cacheDirectory` note above.
  //
  // Tuning preset-env's targets is NOT a lever, despite looking like one: at the
  // default browserslist it adds only 3 niche regex transforms over
  // targets:{node:'current'} (~8% of transform time), and an interleaved cold A/B
  // showed no end-to-end difference. Don't diverge test/prod compilation for it.
  cacheDirectory,
  // Crawl scope, and it is the haste map's rather than testMatch's — those
  // patterns already name these four directories, but jest-haste-map crawls
  // `roots` (default: the whole rootDir) independently of them. Unscoped it
  // stats ~42,000 files that hold no module, `1000g_cnv_build` and the 429MB
  // website corpus among them, which is most of the 3.5s every `jest`
  // invocation spends before it runs anything — the cost `pnpm test-related`
  // and any single-file run pay in full.
  //
  // Test DATA is deliberately outside this. Suites reach `test_data/` by
  // relative `require.resolve`, which stats the file rather than asking the
  // haste map, so those reads do not need the crawl that finding them would.
  roots: [
    '<rootDir>/packages',
    '<rootDir>/products',
    '<rootDir>/plugins',
    '<rootDir>/example-plugins',
  ],
  // Agent worktrees live at `.claude/worktrees/<branch>/`, i.e. whole extra
  // checkouts *inside* rootDir. `testMatch` already misses them (it anchors on
  // `<rootDir>/plugins/**`), but jest-haste-map crawls rootDir independently of
  // it and doesn't read .gitignore, so every worktree contributes a second
  // `packages/__mocks__/@testing-library/react.tsx` and a second
  // `plugins/*/package.json`. Duplicate manual mocks are a warning; duplicate
  // haste packages are a hard `_assertNoDuplicates` throw that fails every suite
  // importing across packages. Nothing under `.claude/` is ever test material,
  // so the whole directory is invisible to the module loader.
  //
  // Anchored at `<rootDir>`, and that is the whole point. These patterns are
  // matched unanchored against ABSOLUTE paths, so a bare `/\.claude/` also
  // matches when rootDir *is* the worktree — every path under
  // `.../.claude/worktrees/<branch>/` contains it, so jest ignored the entire
  // tree and `pnpm test <anything>` reported "0 files checked across 5
  // projects". Which made tests unrunnable from inside the worktrees this rule
  // exists to accommodate.
  modulePathIgnorePatterns: ['<rootDir>/\\.claude/'],
  moduleNameMapper: {
    '^@jbrowse/core/util/useMeasure$':
      '<rootDir>/packages/__mocks__/@jbrowse/core/util/useMeasure.ts',
    '^@jbrowse/text-indexing-core$':
      '<rootDir>/packages/text-indexing-core/src/index.ts',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': '<rootDir>/config/jest/babelTransform.cjs',
    '^.+\\.css$': '<rootDir>/config/jest/cssTransform.cjs',
  },
  transformIgnorePatterns: [
    // react-msaview (and its ESM-only deps) ship untranspiled ESM, so they must
    // be run through babel rather than ignored like the rest of node_modules.
    // The negative lookahead matches these package names anywhere in the pnpm
    // path (`.pnpm/<pkg>@.../node_modules/<pkg>/...`).
    '/node_modules/(?!.*(?:react-msaview|msa-parsers|@jbrowse[+/]svgcanvas|flatbush|flatqueue|colord)).+\\.(js|jsx)$',
    '\\.module\\.(css|sass|scss)$',
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.{js,jsx,ts,tsx}',
    'products/*/src/**/*.{js,jsx,ts,tsx}',
    'plugins/*/src/**/*.{js,jsx,ts,tsx}',
    'example-plugins/*/src/**/*.{js,jsx,ts,tsx}',
  ],
  coveragePathIgnorePatterns: [
    '\\.d\\.ts$',
    'makeWorkerInstance.ts',
    'react-colorful.js',
    'QuickLRU.js',
  ],
  setupFiles: [
    '<rootDir>/config/jest/textEncoder.js',
    '<rootDir>/config/jest/structuredClone.js',
    '<rootDir>/config/jest/blob.js',
    '<rootDir>/config/jest/console.js',
    '<rootDir>/config/jest/messagechannel.js',
    '<rootDir>/config/jest/setHTML.js',
    '<rootDir>/config/jest/resizeObserver.js',
    '<rootDir>/config/jest/pointerEvents.js',
    '<rootDir>/config/jest/requestIdleCallback.js',
    '<rootDir>/config/jest/scrollIntoView.js',
    '<rootDir>/config/jest/topLayer.js',
  ],
  // In every project, not only the one that instantiates displays: the gate is
  // two hooks over a buffer `console.js` fills, so it costs nothing where no
  // display exists, and a project added later inherits it instead of quietly
  // opting out. A project that overrides this key has to spread it back in —
  // see the default project below.
  setupFilesAfterEnv: [
    '<rootDir>/config/jest/contractGate.js',
    '<rootDir>/config/jest/testingLibraryTimeout.js',
  ],
  snapshotSerializers: ['<rootDir>/config/jest/emotionClassSerializer.cjs'],
  testEnvironmentOptions: { url: 'http://localhost' },
}

export default {
  // Never a bare percentage, and never unbounded. resolveMaxWorkers() above has
  // the tiers; the reasons for the numbers are here.
  //
  // One worker is safe here, and NOT the same thing as in-band. The hazard is
  // real — the full-app integration suites each retain ~140MB (root model + RPC
  // workers + autoruns are not torn down), so a lone accumulating process climbs
  // to the heap ceiling and OOMs — but it is in-band that has it, because
  // nothing recycles the main process. A worker gets recycled the moment it
  // passes workerIdleMemoryLimit, which caps memory whatever the per-suite leak.
  //
  // jest only runs in-band on a worker count of 1 when workerIdleMemoryLimit is
  // unset: `shouldRunInBand` (jest 30.4.2, @jest/core) guards its whole
  // one-worker-or-one-test branch behind `workerIdleMemoryLimit === undefined`,
  // commented "when specifying a memory limit, workers should be used". The
  // limit is set right below, so maxWorkers 1 forks one real worker. Verified by
  // counting a run's own worker children: 1 with the limit set, 0 without.
  //
  // `--runInBand` is the thing to avoid, and no worker count reaches it. It is
  // the first branch of that function and returns before the limit is consulted,
  // so it re-enables exactly the OOM described above.
  //
  // A bare percentage is still wrong, and the earlier reading of why is still
  // right: it scales with the machine and not with what the machine has left,
  // so on a big dev box it is 8+ workers each entitled to workerIdleMemoryLimit
  // before it is recycled. `resolveMaxWorkers` keeps a ceiling for that and then
  // subtracts what is already in use.
  //
  // The 4 that ceiling used to be was measured on `packages/core/src/util`
  // alone (98 suites, warm: 18.8/17.2s at 2, 25.1/19.9s at 4, 20.9/24.3s at 8),
  // and that file said what it did not cover — "the slow integration files may
  // spread better and were not measured". They do, and they are 54% of the
  // clock: whole-suite on a quiet box the run is 372s at 4 workers and 262s at
  // 8, each worker ~97% occupied at both. The reason a directory of unit tests
  // could not see it is that its suites are ~0.1s each, so the run is dominated
  // by jest's own ~3.5s of startup, which no worker count divides.
  //
  // This has to live in the config rather than in a `--maxWorkers` flag on the
  // package.json scripts: ~15 package-level `test` scripts invoke `jest`
  // directly (`cd ../..; jest --passWithNoTests <pkg>`) and would ignore a flag
  // set on the root script. An explicit `--maxWorkers` on the command line still
  // outranks everything here, since jest applies argv over config.
  //
  // CI is unchanged in shape: it sets no override, and at 4 CPUs and 16GB the
  // ceiling yields 2 — what the '50%' before this yielded there.
  maxWorkers: resolveMaxWorkers(),
  workerIdleMemoryLimit: '1500MB',
  // must live at the root: jest drops testTimeout from entries in `projects`,
  // so a copy inside baseConfig silently leaves every test on the 5s default
  testTimeout: 15000,
  // Each project names its own `id`. Jest otherwise derives one from rootDir,
  // and it is the transform cache's directory name — a derived id gives every
  // worktree its own private copy of a cache whose entries are content-addressed
  // and would have been valid in all of them. The haste map stays per-checkout
  // regardless: its filename carries a rootDir hash of its own.
  projects: [
    {
      // Root-level integration test
      displayName: 'integration',
      testMatch: ['<rootDir>/integration.test.js'],
      testEnvironment: 'node',
      ...baseConfig,
      id: 'jbrowse-integration',
      roots: ['<rootDir>'],
    },
    {
      // Pure helpers behind the docs autogeneration scripts
      displayName: 'docs',
      testMatch: ['<rootDir>/website/scripts/**/*.test.ts'],
      testEnvironment: 'node',
      ...baseConfig,
      id: 'jbrowse-docs',
      roots: ['<rootDir>/website/scripts'],
    },
    {
      // Release tooling: the blog-post render/parse contract
      displayName: 'scripts',
      testMatch: ['<rootDir>/scripts/**/*.test.ts'],
      testEnvironment: 'node',
      ...baseConfig,
      id: 'jbrowse-scripts',
      roots: ['<rootDir>/scripts'],
    },
    {
      // jbrowse-img uses the node environment and the real fetch, unmocked
      displayName: 'jbrowse-img',
      testMatch: ['<rootDir>/products/jbrowse-img/**/*.test.ts'],
      testPathIgnorePatterns: ['/dist/', '/demos/'],
      testEnvironment: 'node',
      ...baseConfig,
      id: 'jbrowse-img',
    },
    {
      // All other tests use jsdom with the fetch mock below
      displayName: 'default',
      testMatch: [
        '<rootDir>/packages/**/*.test.{ts,tsx,js,jsx}',
        '<rootDir>/products/**/*.test.{ts,tsx,js,jsx}',
        '<rootDir>/plugins/**/*.test.{ts,tsx,js,jsx}',
        '<rootDir>/example-plugins/**/*.test.{ts,tsx,js,jsx}',
      ],
      testPathIgnorePatterns: [
        '/dist/',
        '/demos/',
        '<rootDir>/products/jbrowse-img/',
        // Own lockfile/test runner (vitest), CI'd separately (blat_proxy job).
        '<rootDir>/products/aws/',
      ],
      // jsdom, plus node's fetch/Response/Request/Headers — jsdom ships no
      // fetch at all and a `Headers` that strips `range`. See the file.
      testEnvironment: '<rootDir>/config/jest/jsdomWithFetch.cjs',
      ...baseConfig,
      id: 'jbrowse-default',
      // After the spread, and spreading baseConfig's own entry back in: this key
      // is the one both halves define, and `...baseConfig` last would otherwise
      // drop all three of these.
      setupFilesAfterEnv: [
        ...baseConfig.setupFilesAfterEnv,
        '<rootDir>/config/jest/fetchMockAfterEnv.js',
        '<rootDir>/config/jest/deterministicIds.js',
        '<rootDir>/config/jest/localStorage.js',
      ],
    },
  ],
}
