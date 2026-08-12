import os from 'node:os'

// availableParallelism() honours the CPU affinity mask, so a run already pinned
// to a subset of cores (taskset, a container's cpuset) sizes itself to what it
// was actually given. os.cpus().length reports every core on the box regardless.
const cpuCount = os.availableParallelism?.() ?? os.cpus().length

// Worker budget, most specific wins. See the maxWorkers comment below for why
// each tier is where it is.
function resolveMaxWorkers() {
  // 1. Explicit override, for the run that genuinely wants the whole box.
  //    `JEST_MAX_WORKERS=12 pnpm test <dir>`. Ignored unless it parses to >0, so
  //    a stray empty or garbage value falls through instead of pinning to NaN.
  const override = Number(process.env.JEST_MAX_WORKERS)
  if (Number.isInteger(override) && override > 0) {
    return override
  }

  // 2. Agent sessions get 2. Claude Code exports CLAUDECODE=1 into every command
  //    it runs, and it is not in any shell profile here, so it marks agent runs
  //    and only agent runs — a human `pnpm test` in a normal terminal never sees
  //    it. Several agent worktrees run suites concurrently and each one sizes
  //    itself independently, so the machine-wide total is (per-run budget) x
  //    (however many agents), which is what actually saturates the box: two
  //    sessions at the old '50%' measured 8 workers each on a 16-core machine,
  //    16 total, and nothing in a per-run config could see the other half.
  //    2 keeps a handful of concurrent agents inside the core count, and stays
  //    at the >1 floor the OOM note below requires.
  if (process.env.CLAUDECODE) {
    return 2
  }

  // 3. Interactive runs: half the machine, clamped.
  return Math.min(4, Math.max(2, Math.floor(cpuCount / 2)))
}

const baseConfig = {
  // Pinned off /tmp (jest defaults to /tmp/jest_<uid>). Cache warmth is the
  // single biggest lever on jest startup here: transpiling the plugin graph
  // costs a serial prefix before any test body runs, measured repeatedly at
  // ~19-26s cold vs ~5-7s warm for one trivial suite. Keeping it out of /tmp
  // matters because /tmp is tmpfs on Linux dev boxes, so the ~200MB cache both
  // sat in RAM competing with the workers and was lost on every reboot. On disk
  // it survives reboots, and CI can restore it between runs (push.yml). Entries
  // are keyed on file content + transformer config, so a partially stale cache
  // is never wrongly reused, only re-transformed.
  //
  // Tuning preset-env's targets is NOT a lever, despite looking like one: at the
  // default browserslist it adds only 3 niche regex transforms over
  // targets:{node:'current'} (~8% of transform time), and an interleaved cold A/B
  // showed no end-to-end difference. Don't diverge test/prod compilation for it.
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
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
    '<rootDir>/config/jest/console.js',
    '<rootDir>/config/jest/messagechannel.js',
    '<rootDir>/config/jest/setHTML.js',
    '<rootDir>/config/jest/resizeObserver.js',
    '<rootDir>/config/jest/pointerEvents.js',
    '<rootDir>/config/jest/requestIdleCallback.js',
    '<rootDir>/config/jest/scrollIntoView.js',
  ],
  testEnvironmentOptions: { url: 'http://localhost' },
}

export default {
  // Never a bare percentage, and never unbounded. resolveMaxWorkers() above has
  // the tiers; the reasons for the numbers are here.
  //
  // Floor of 2, which every tier respects: '25%' resolves to a single worker on
  // 4-core CI runners, which Jest runs in-band in the main process. The full-app
  // integration suites each retain ~140MB (root model + RPC workers + autoruns
  // are not torn down), so a lone accumulating process climbs to the heap
  // ceiling and OOMs. Using >1 worker plus workerIdleMemoryLimit recycles a
  // worker once it grows past the limit, capping memory regardless of the
  // per-suite leak.
  //
  // Ceiling of 4: a bare percentage scales with the machine, and on a big dev
  // box that is 8+ workers each entitled to workerIdleMemoryLimit before it is
  // recycled — enough to wedge the whole machine. Suite wall-clock is dominated
  // by the serial transform prefix and by a handful of slow integration files,
  // so the workers past ~4 buy much less than they cost.
  //
  // This has to live in the config rather than in a `--maxWorkers` flag on the
  // package.json scripts: ~15 package-level `test` scripts invoke `jest`
  // directly (`cd ../..; jest --passWithNoTests <pkg>`) and would ignore a flag
  // set on the root script. An explicit `--maxWorkers` on the command line still
  // outranks everything here, since jest applies argv over config.
  //
  // CI is unchanged: it sets neither env var, and at 4 CPUs the clamp yields 2,
  // exactly what the '50%' this replaced yielded there.
  maxWorkers: resolveMaxWorkers(),
  workerIdleMemoryLimit: '1500MB',
  // must live at the root: jest drops testTimeout from entries in `projects`,
  // so a copy inside baseConfig silently leaves every test on the 5s default
  testTimeout: 15000,
  projects: [
    {
      // Root-level integration test
      displayName: 'integration',
      testMatch: ['<rootDir>/integration.test.js'],
      testEnvironment: 'node',
      ...baseConfig,
    },
    {
      // Pure helpers behind the docs autogeneration scripts
      displayName: 'docs',
      testMatch: ['<rootDir>/website/scripts/**/*.test.ts'],
      testEnvironment: 'node',
      ...baseConfig,
    },
    {
      // Release tooling: the blog-post render/parse contract
      displayName: 'scripts',
      testMatch: ['<rootDir>/scripts/**/*.test.ts'],
      testEnvironment: 'node',
      ...baseConfig,
    },
    {
      // jbrowse-img uses Node environment with native fetch (no jest-fetch-mock)
      displayName: 'jbrowse-img',
      testMatch: ['<rootDir>/products/jbrowse-img/**/*.test.ts'],
      testPathIgnorePatterns: ['/dist/', '/demos/'],
      testEnvironment: 'node',
      ...baseConfig,
    },
    {
      // All other tests use jsdom with jest-fetch-mock
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
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [
        '<rootDir>/config/jest/fetchMockAfterEnv.js',
        '<rootDir>/config/jest/deterministicIds.js',
        '<rootDir>/config/jest/localStorage.js',
      ],
      ...baseConfig,
    },
  ],
}
