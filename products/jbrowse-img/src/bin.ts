#!/usr/bin/env node
import { enableCompileCache, registerHooks } from 'node:module'

import { resolve } from './resolve.ts'

// Install the react-transition-group resolve hook (see resolve.ts) BEFORE the
// heavy module graph is loaded. The graph statically imports @mui/material,
// whose ESM build deep-imports a directory-stub subpath that Node's ESM loader
// rejects (ERR_UNSUPPORTED_DIR_IMPORT). The hook must be active before linking,
// so main.ts is pulled in via dynamic import here rather than a static import —
// a static import would link (and fail) before registerHooks() runs.
// The render stack is some four thousand modules, and compiling them is a fifth
// of a process's start. V8 keeps the compiled form on disk from the second run.
enableCompileCache()

registerHooks({ resolve })

await import('./main.ts')
