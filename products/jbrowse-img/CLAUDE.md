# jbrowse-img

## Testing

Two separate test suites:

**Unit tests** — pure data/parsing functions, run via Jest from the repo root:
```
pnpm test products/jbrowse-img
```

**Integration tests** — full SVG rendering using `node:test` + tsx, run from this directory:
```
pnpm test:integration
```

The integration tests live in `test/` and import from `src/` directly via tsx. They do **not** use Jest because jsdom (required by `setupEnv` for `document.createElement`) brings in pure-ESM dependencies (`@exodus/bytes`, `parse5`) that Jest's Babel-CJS transform pipeline cannot handle. tsx resolves workspace TypeScript sources natively and avoids this entirely.

`setupEnv()` must be called before rendering — it sets up jsdom (`document`/`window`) and the canvas globals needed by `renderToSvg`.

`RpcServer.ts` references `self` at module load time. It guards with `typeof self !== 'undefined'` so it doesn't throw in non-worker Node contexts (CLI, tests).
