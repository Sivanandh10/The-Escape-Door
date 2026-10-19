// Lets plain Node (>= 22.15 / 24, native TS type-stripping) import this repo's .ts modules,
// which use bundler-style extensionless relative imports and the "@/" alias.
// Usage (must run BEFORE the .ts import, so use a dynamic import after it):
//   import './src/lib/data/node-ts-hook.mjs'
//   const { products } = await import('./src/lib/data/seed.ts')
// Owner: F2. Used by scripts/gen-seed-sql.mjs, src/lib/pricing.test.ts, and free for the
// mockup generator.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const EXTS = ['.ts', '.tsx', '.mts', '/index.ts']

function tryResolveFile(base) {
  if (existsSync(base) && !base.endsWith(path.sep) && path.extname(base)) return base
  for (const ext of EXTS) if (existsSync(base + ext)) return base + ext
  return null
}

// The package.json has no "type", so tell Node that .ts files here are ES modules
// (avoids the MODULE_TYPELESS_PACKAGE_JSON reparse warning).
const asTsModule = (r) => (r && /\.(ts|tsx|mts)$/.test(r.url) ? { ...r, format: 'module-typescript' } : r)

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null
    if (specifier.startsWith('@/')) base = path.join(SRC, specifier.slice(2))
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    }
    if (base) {
      const file = tryResolveFile(base)
      if (file) return asTsModule(nextResolve(pathToFileURL(file).href, context))
    }
    return asTsModule(nextResolve(specifier, context))
  },
})
