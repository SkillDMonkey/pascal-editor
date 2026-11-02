import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Serves an external asset catalog (its catalog.json, models and previews)
 * through the editor's own origin, so the browser loads them without CORS.
 * The source is the base URL in CATALOG_ASSETS_SOURCE_URL. Without it the
 * route answers 404 and the editor keeps its built-in catalog.
 */
const SOURCE = process.env.CATALOG_ASSETS_SOURCE_URL
const SAFE_PATH = /^[a-zA-Z0-9_./-]+$/

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!SOURCE) return new Response(null, { status: 404 })
  const { path } = await context.params
  const relative = path.join('/')
  if (!SAFE_PATH.test(relative) || relative.includes('..') || relative.startsWith('/') || relative.includes('//')) {
    return new Response('invalid path', { status: 400 })
  }
  const base = SOURCE.endsWith('/') ? SOURCE : `${SOURCE}/`
  const target = new URL(relative, base)
  // the path must stay under the configured source: no other host, no way above it
  if (target.origin !== new URL(base).origin || !target.href.startsWith(base)) {
    return new Response('invalid path', { status: 400 })
  }
  const response = await fetch(target, { cache: 'no-store' })
  if (!response.ok || !response.body) {
    return new Response(null, { status: response.status === 404 ? 404 : 502 })
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': relative.endsWith('.json') ? 'no-store' : 'public, max-age=300',
    },
  })
}
