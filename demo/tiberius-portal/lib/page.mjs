// index.html is built twice from one component tree: once here to a string, so
// the cards and their captures are in the file before any script runs, and once
// in the browser to hydrate what takes input. The page still works with the
// script blocked — it just stops taking verdicts.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = import.meta.dirname

const SHARED = {
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  // React ships its warnings and its slow paths under this flag, and a portal
  // built without it is both bigger and noisier in a reviewer's console.
  define: { 'process.env.NODE_ENV': '"production"' },
}

async function build(esbuild, entry, out, extra) {
  await esbuild.build({
    ...SHARED,
    ...extra,
    entryPoints: [path.join(HERE, entry)],
    outfile: out,
  })
  return fs.readFileSync(out, 'utf8')
}

export async function renderPage({ data, title }) {
  let esbuild
  try {
    esbuild = await import('esbuild')
  } catch {
    throw new Error(
      'esbuild did not resolve, and the review page is built with it. Run `pnpm install` in this checkout.',
    )
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gene-review-page-'))
  try {
    const serverFile = path.join(dir, 'server.mjs')
    await build(esbuild, 'server.jsx', serverFile, {
      platform: 'node',
      // react-dom/server is CommonJS and reaches for node builtins through a
      // bare require(), which an ESM bundle has no such thing as.
      banner: {
        js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
      },
    })
    const { render } = await import(pathToFileURL(serverFile).href)
    const appHtml = render(data)
    const appJs = await build(
      esbuild,
      'client.jsx',
      path.join(dir, 'client.js'),
      {
        platform: 'browser',
        format: 'iife',
        minify: true,
        target: ['es2020'],
      },
    )

    const template = fs.readFileSync(path.join(HERE, 'template.html'), 'utf8')
    // A string replacement is read for $& and $1 before it is inserted, and
    // minified React is full of both — so every one of these takes a function.
    return template
      .replace('__TITLE__', () => title.replaceAll(/[<&]/g, ''))
      .replace('__APP_HTML__', () => appHtml)
      .replace('__DATA__', () => closeTags(JSON.stringify(data)))
      .replace('__APP_JS__', () => closeTags(appJs))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// `</script>` inside the JSON or the bundle would close the tag it sits in
function closeTags(s) {
  return s.replaceAll('</', String.raw`<\/`)
}
