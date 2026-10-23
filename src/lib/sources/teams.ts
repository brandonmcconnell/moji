import type { EmojiRecord } from '../types'

export type TeamsProfile = {
  tenantId: string
  label: string
}

export type TeamsEmojiImage = EmojiRecord & { dataUrl: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

export function readJwtPayload(token: string): Record<string, unknown> {
  const segment = token.split('.')[1]
  if (!segment) return {}
  try {
    const json = atob(segment.replaceAll('-', '+').replaceAll('_', '/'))
    const payload = asRecord(JSON.parse(json) as unknown)
    return payload ?? {}
  } catch {
    return {}
  }
}

export function teamsProfileFromToken(accessToken: string): TeamsProfile {
  const payload = readJwtPayload(accessToken)
  const tenantId = typeof payload.tid === 'string' ? payload.tid : ''
  const name =
    (typeof payload.name === 'string' && payload.name) ||
    (typeof payload.preferred_username === 'string' && payload.preferred_username) ||
    'Microsoft Teams'
  if (!tenantId) throw new Error('Microsoft did not include a tenant in the sign-in token.')
  return { tenantId, label: name }
}

function mimeFromBytes(bytes: Uint8Array): { mime: string; animated: boolean } | null {
  const gif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (gif) return { mime: 'image/gif', animated: true }
  if (png) return { mime: 'image/png', animated: false }
  return null
}

export function teamsEmojiFromContent(displayName: string, contentBytes: string, tenantId: string): TeamsEmojiImage | null {
  const name = displayName.trim().toLowerCase().replaceAll(/\s+/g, '_')
  if (!/^[a-z0-9_+-]{1,100}$/.test(name)) return null
  let bytes: Uint8Array
  try {
    const binary = atob(contentBytes)
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
  const kind = mimeFromBytes(bytes)
  if (!kind) return null
  return {
    name,
    animated: kind.animated,
    url: '',
    cacheKey: `teams:${tenantId}:${name}`,
    dataUrl: `data:${kind.mime};base64,${contentBytes}`,
  }
}

type GraphPage = {
  value?: unknown
  '@odata.nextLink'?: unknown
}

export async function teamsListEmoji(accessToken: string, tenantId: string): Promise<TeamsEmojiImage[]> {
  const emoji: TeamsEmojiImage[] = []
  let next: string | null = 'https://graph.microsoft.com/beta/teamwork/messaging/customEmojis'
  while (next) {
    const response = await fetch(next, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (response.status === 401) throw new Error('Microsoft Teams needs you to sign in again.')
    if (response.status === 403) {
      throw new Error('Teams refused emoji access. An admin may need to consent to TeamworkCustomEmoji.Read.')
    }
    if (!response.ok) throw new Error(`Teams replied with HTTP ${response.status}.`)
    const payload = (await response.json()) as GraphPage
    if (Array.isArray(payload.value)) {
      for (const entry of payload.value) {
        const record = asRecord(entry)
        if (!record || typeof record.displayName !== 'string' || typeof record.contentBytes !== 'string') continue
        const parsed = teamsEmojiFromContent(record.displayName, record.contentBytes, tenantId)
        if (parsed) emoji.push(parsed)
      }
    }
    next = typeof payload['@odata.nextLink'] === 'string' ? payload['@odata.nextLink'] : null
  }
  return emoji
}

export function readTeamsTokenResponse(payload: unknown): {
  accessToken: string
  refreshToken: string
  expiresAt: number
} {
  const record = asRecord(payload)
  const accessToken = record && typeof record.access_token === 'string' ? record.access_token : ''
  if (!accessToken) {
    const error = record && typeof record.error_description === 'string' ? record.error_description : 'Microsoft did not return a token.'
    throw new Error(error)
  }
  const refreshToken = record && typeof record.refresh_token === 'string' ? record.refresh_token : ''
  const expiresIn = record && typeof record.expires_in === 'number' ? record.expires_in : 3600
  return { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 }
}
