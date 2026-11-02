'use client'

import { BuildingNode, LevelNode, SiteNode, WallNode } from '@pascal-app/core'
import type { SceneGraph } from '@pascal-app/editor'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/** Distance in metres between two terrain samples. */
const SAMPLE_STEP = 1
/** Metres per height unit: the sender works in centimetres. */
const HEIGHT_UNIT = 0.01
/** Thickness of the four outer walls, in metres. */
const WALL_THICKNESS = 0.3
/** Pascal accepts at most this many terrain samples per side. */
const MAX_SAMPLES = 257

/** Bilinear sample of the n × n height grid at (u, v), both in 0..1. */
function sampleGrid(grid: Int16Array, n: number, u: number, v: number): number {
  const fx = Math.min(n - 1.0001, Math.max(0, u * (n - 1)))
  const fy = Math.min(n - 1.0001, Math.max(0, v * (n - 1)))
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const a = fx - i
  const b = fy - j
  const k = j * n + i
  return (
    ((grid[k] ?? 0) * (1 - a) + (grid[k + 1] ?? 0) * a) * (1 - b) +
    ((grid[k + n] ?? 0) * (1 - a) + (grid[k + n + 1] ?? 0) * a) * b
  )
}

/** Heightfield terrain for a w × d metre lot, resampled from the base64 Int16 grid `q`. */
function lotTerrain(w: number, d: number, n: number, q: string) {
  if (!q || n < 2) return undefined
  // a malformed grid gives flat ground instead of an exception that would leave the page stuck
  let raw: Uint8Array
  try {
    raw = Uint8Array.from(atob(q), (c) => c.charCodeAt(0))
  } catch {
    return undefined
  }
  if (raw.length % 2 !== 0) return undefined
  const grid = new Int16Array(raw.buffer)
  if (n * n > grid.length) return undefined
  const cols = Math.min(MAX_SAMPLES, Math.round(w / SAMPLE_STEP) + 1)
  const rows = Math.min(MAX_SAMPLES, Math.round(d / SAMPLE_STEP) + 1)
  const output = new Int16Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      output[r * cols + c] = Math.round(sampleGrid(grid, n, c / (cols - 1), r / (rows - 1)))
    }
  }
  const bytes = new Uint8Array(output.buffer)
  let binary = ''
  for (const x of bytes) binary += String.fromCharCode(x)
  return {
    type: 'heightfield',
    origin: [-w / 2, -d / 2],
    spacing: w / (cols - 1),
    cols,
    rows,
    step: HEIGHT_UNIT,
    heights: btoa(binary),
  }
}

/**
 * Scene for a new lot: a site polygon of w × d metres (with the terrain when
 * given), one building and one level, and four outer walls on the lot edge.
 * The outer face of each wall sits exactly on the edge, so two lots side by
 * side give walls that touch, as in a terrace of houses.
 */
function lotSceneGraph(w: number, d: number, n: number, q: string): SceneGraph {
  const points = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ]
  const terrain = lotTerrain(w, d, n, q)
  const site = SiteNode.parse({
    polygon: { type: 'polygon', points },
    ...(terrain ? { terrain } : {}),
  })
  const building = BuildingNode.parse({ parentId: site.id })
  const level = LevelNode.parse({ parentId: building.id, level: 0, children: [], height: 3 })
  const t = WALL_THICKNESS / 2
  const corners: [number, number][] = [
    [-w / 2 + t, -d / 2 + t],
    [w / 2 - t, -d / 2 + t],
    [w / 2 - t, d / 2 - t],
    [-w / 2 + t, d / 2 - t],
  ]
  const walls = corners.map((start, i) =>
    WallNode.parse({
      parentId: level.id,
      start,
      end: corners[(i + 1) % 4],
      thickness: WALL_THICKNESS,
      height: 3,
    }),
  )
  return {
    nodes: {
      [site.id]: { ...site, children: [building.id] },
      [building.id]: { ...building, children: [level.id] },
      [level.id]: { ...level, children: walls.map((wall) => wall.id) },
      ...Object.fromEntries(walls.map((wall) => [wall.id, wall])),
    },
    rootNodeIds: [site.id],
  } as SceneGraph
}

export function LotClient(props: {
  id: string
  name: string
  w: number
  d: number
  n: number
  q: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState('Entering the lot…')
  useEffect(() => {
    let done = false
    async function enter() {
      const { id, name, w, d, n, q } = props
      if (!id) {
        setStatus('The lot id is missing')
        return
      }
      // Open the lot's scene if it already exists, otherwise create it.
      const existing = await fetch(`/api/scenes/${encodeURIComponent(id)}`)
      if (!existing.ok) {
        const created = await fetch('/api/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name, graph: lotSceneGraph(w, d, n, q) }),
        })
        if (!created.ok) {
          setStatus(`Could not create the scene for this lot (${created.status})`)
          return
        }
      }
      if (!done) router.replace(`/project/${encodeURIComponent(id)}`)
    }
    void enter()
    return () => {
      done = true
    }
  }, [props, router])
  return <p>{status}</p>
}
