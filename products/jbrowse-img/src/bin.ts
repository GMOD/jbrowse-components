#!/usr/bin/env node
import { enableCompileCache, registerHooks } from 'node:module'

import { resolve } from './resolve.ts'

enableCompileCache()

registerHooks({ resolve })

// dynamic, because a static import would link before registerHooks() runs
await import('./main.ts')
