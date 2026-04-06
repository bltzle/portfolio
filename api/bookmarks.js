import { createClient } from 'redis'

export default async function handler(req, res) {
  const client = createClient({ url: process.env.REDIS_URL })
  await client.connect()

  if (req.method === 'POST') {
    const { paper, flowers } = req.body || {}
    if (!flowers || !Array.isArray(flowers) || flowers.length === 0) {
      await client.disconnect()
      return res.status(400).json({ error: 'Invalid bookmark data' })
    }
    if (flowers.length > 50) {
      await client.disconnect()
      return res.status(400).json({ error: 'Too many flowers' })
    }
    const bookmark = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      paper: paper || 'cream',
      flowers: flowers.map(f => ({
        type: String(f.type).slice(0, 30),
        x: Math.max(0, Math.min(100, Number(f.x) || 50)),
        y: Math.max(0, Math.min(100, Number(f.y) || 50)),
        rotation: Number(f.rotation) || 0,
        scale: Math.max(0.3, Math.min(2.5, Number(f.scale) || 1)),
        flipped: Boolean(f.flipped),
      })),
      created: Date.now(),
    }
    await client.zAdd('flower_bookmarks', {
      score: bookmark.created,
      value: JSON.stringify(bookmark),
    })
    await client.disconnect()
    return res.json({ ok: true, id: bookmark.id })
  }

  // GET
  const entries = await client.zRange('flower_bookmarks', 0, -1, { REV: true })
  await client.disconnect()
  const bookmarks = entries.map(e => JSON.parse(e))
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')
  return res.json(bookmarks)
}
