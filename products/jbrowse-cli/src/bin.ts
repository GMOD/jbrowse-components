#!/usr/bin/env node

import { main } from './index'

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(e)
})
