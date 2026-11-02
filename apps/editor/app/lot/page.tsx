import { LotClient } from './lot-client'

export const dynamic = 'force-dynamic'

/**
 * `/lot?id=&name=&w=&d=&n=&q=`: opened by an external client when a lot is
 * entered. It opens the lot's scene if it already exists; otherwise it creates
 * one on ground shaped like the lot: a w × d metre site whose terrain comes
 * from the n × n grid of heights `q` (Int16 centimetres, base64, relative to
 * the lot's lowest point).
 */
export default async function LotPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string
    name?: string
    w?: string
    d?: string
    n?: string
    q?: string
  }>
}) {
  const p = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm">
      <LotClient
        d={Number(p.d ?? 12)}
        id={p.id ?? ''}
        n={Number(p.n ?? 0)}
        name={p.name ?? 'Lot'}
        q={p.q ?? ''}
        w={Number(p.w ?? 10)}
      />
    </div>
  )
}
