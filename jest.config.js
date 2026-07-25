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
  ],
  testEnvironmentOptions: { url: 'http://localhost' },
}

export default {
  // '25%' resolves to a single worker on 4-core CI runners, which Jest runs
  // in-band in the main process. The full-app integration suites each retain
  // ~140MB (root model + RPC workers + autoruns are not torn down), so a lone
  // accumulating process climbs to the heap ceiling and OOMs. Using >1 worker
  // plus workerIdleMemoryLimit recycles a worker once it grows past the limit,
  // capping memory regardless of the per-suite leak.
  maxWorkers: '50%',
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
      testMatch: ['<rootDir>/docs/**/*.test.ts'],
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
      testPathIgnorePatterns: ['/dist/', '/cypress/', '/demos/'],
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
        '/cypress/',
        '/demos/',
        '<rootDir>/products/jbrowse-img/',
      ],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [
        '<rootDir>/config/jest/fetchMockAfterEnv.js',
        '<rootDir>/config/jest/deterministicIds.js',
      ],
      ...baseConfig,
    },
  ],
}
