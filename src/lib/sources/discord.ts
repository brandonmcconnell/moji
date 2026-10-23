import type { DiscordGuildChoice, EmojiRecord } from '../types'

type DiscordEmoji = {
  id?: string
  name?: string | null
  animated?: boolean
  available?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

async function discordFetch(token: string, tokenType: 'Bot' | 'Bearer', path: string): Promise<unknown> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `${tokenType} ${token}` },
  })
  if (response.status === 401) throw new Error('Discord rejected the sign-in. Connect again.')
  if (!response.ok) {
    const body = asRecord(await response.json().catch(() => null))
    const message = body && typeof body.message === 'string' ? body.message : `Discord replied with HTTP ${response.status}.`
    throw new Error(message)
  }
  return response.json() as Promise<unknown>
}

export async function discordCurrentUser(accessToken: string): Promise<{ id: string; username: string }> {
  const payload = asRecord(await discordFetch(accessToken, 'Bearer', '/users/@me'))
  const id = payload && typeof payload.id === 'string' ? payload.id : ''
  const username = payload && typeof payload.username === 'string' ? payload.username : 'Discord'
  if (!id) throw new Error('Discord did not return the signed-in account.')
  return { id, username }
}

export async function discordUserGuilds(accessToken: string): Promise<DiscordGuildChoice[]> {
  const payload = await discordFetch(accessToken, 'Bearer', '/users/@me/guilds')
  return guildList(payload)
}

export async function discordBotGuilds(botToken: string): Promise<DiscordGuildChoice[]> {
  const payload = await discordFetch(botToken, 'Bot', '/users/@me/guilds')
  return guildList(payload)
}

function guildList(payload: unknown): DiscordGuildChoice[] {
  if (!Array.isArray(payload)) return []
  const guilds: DiscordGuildChoice[] = []
  for (const entry of payload) {
    const record = asRecord(entry)
    if (!record || typeof record.id !== 'string' || typeof record.name !== 'string') continue
    guilds.push({ id: record.id, name: record.name })
  }
  guilds.sort((a, b) => a.name.localeCompare(b.name))
  return guilds
}

export function discordEmojiUrl(id: string, animated: boolean): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=128&quality=lossless`
}

export async function discordGuildEmoji(botToken: string, guildId: string): Promise<Record<string, EmojiRecord>> {
  const payload = await discordFetch(botToken, 'Bot', `/guilds/${guildId}/emojis`)
  if (!Array.isArray(payload)) throw new Error('Discord did not return emoji for that server.')
  const records: Record<string, EmojiRecord> = {}
  for (const entry of payload as DiscordEmoji[]) {
    if (!entry.id || !entry.name || entry.available === false) continue
    const name = entry.name.toLowerCase()
    if (!/^[a-z0-9_+-]{1,100}$/.test(name)) continue
    const animated = entry.animated === true
    records[name] = {
      name,
      animated,
      url: discordEmojiUrl(entry.id, animated),
      cacheKey: `discord:${guildId}:${entry.id}`,
    }
  }
  return records
}

export function readDiscordTokenResponse(payload: unknown): {
  accessToken: string
  refreshToken: string
  expiresAt: number
} {
  const record = asRecord(payload)
  const accessToken = record && typeof record.access_token === 'string' ? record.access_token : ''
  if (!accessToken) {
    const error = record && typeof record.error_description === 'string' ? record.error_description : 'Discord did not return a token.'
    throw new Error(error)
  }
  const refreshToken = record && typeof record.refresh_token === 'string' ? record.refresh_token : ''
  const expiresIn = record && typeof record.expires_in === 'number' ? record.expires_in : 0
  return { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 }
}
