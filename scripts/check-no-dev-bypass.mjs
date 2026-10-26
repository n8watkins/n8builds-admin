// Runs after `next build` (npm's postbuild): fails the build if any compiled
// server or client file still reads ADMIN_DEV_BYPASS. In a production build
// lib/auth/dev-bypass.ts compiles to `return false`, so the read must be gone;
// if it is ever there, the dev-only sign-in bypass could reach production.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['.next/server', '.next/static']
const read = /env\s*(?:\.\s*ADMIN_DEV_BYPASS|\[\s*["'`]ADMIN_DEV_BYPASS)/
const offenders = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.(c|m)?js$/.test(name) && read.test(readFileSync(path, 'utf8'))) offenders.push(path)
  }
}

for (const root of roots) {
  try {
    walk(root)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

if (offenders.length > 0) {
  console.error('The dev sign-in bypass survived the production build in:\n' + offenders.map((path) => `  ${path}`).join('\n'))
  process.exit(1)
}
console.log('check-no-dev-bypass: the dev sign-in bypass is compiled out.')
