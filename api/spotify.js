export default async function handler(req, res) {
  const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
      client_id: process.env.SPOTIFY_CLIENT_ID,
    }),
  })

  const { access_token } = await refreshRes.json()
  if (!access_token) {
    res.status(500).json({ error: 'Failed to get access token' })
    return
  }

  const tracksRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const data = await tracksRes.json()

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate')
  res.json(data.items ?? [])
}
