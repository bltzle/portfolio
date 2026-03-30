import { createClient } from 'redis'

export default async function handler(req, res) {
  const client = createClient({ url: process.env.REDIS_URL })
  await client.connect()

  const stored = await client.get('spotify_refresh_token')
  const refreshToken = stored || process.env.SPOTIFY_REFRESH_TOKEN

  const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID,
    }),
  })

  const tokenData = await refreshRes.json()
  if (!tokenData.access_token) {
    await client.disconnect()
    res.status(500).json({ error: 'Failed to get access token' })
    return
  }

  if (tokenData.refresh_token) {
    await client.set('spotify_refresh_token', tokenData.refresh_token)
  }

  await client.disconnect()

  const tracksRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const data = await tracksRes.json()

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate')
  res.json(data.items ?? [])
}
