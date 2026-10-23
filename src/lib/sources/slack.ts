import type { EmojiRecord } from '../types'

export type SlackAuth = {
  teamId: string
  teamName: string
  userId: string
}

export type SlackEmojiPage = {
  emoji: Record<string, string>
  nextCursor: string
}

type SlackOk = { ok?: boolean; error?: string }

function slackError(payload: SlackOk, fallback: string): string {
  return payload.error && payload.error.length > 0 ? payload.error : fallback
}

async function slackGet(token: string, method: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`https://slack.com/api/${method}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`Slack replied with HTTP ${response.status}.`)
  return response.json() as Promise<unknown>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

export async function slackAuthTest(token: string): Promise<SlackAuth> {
  const payload = asRecord(await slackGet(token, 'auth.test'))
  if (!payload || payload.ok !== true) {
    throw new Error(slackError((payload ?? {}) as SlackOk, 'Slack rejected that token.'))
  }
  const teamId = typeof payload.team_id === 'string' ? payload.team_id : ''
  const teamName = typeof payload.team === 'string' ? payload.team : 'Slack workspace'
  const userId = typeof payload.user_id === 'string' ? payload.user_id : ''
  if (!teamId) throw new Error('Slack did not say which workspace this token belongs to.')
  return { teamId, teamName, userId }
}

export async function slackEmojiPage(token: string, cursor = ''): Promise<SlackEmojiPage> {
  const params: Record<string, string> = {}
  if (cursor) params.cursor = cursor
  const payload = asRecord(await slackGet(token, 'emoji.list', params))
  if (!payload || payload.ok !== true) {
    throw new Error(slackError((payload ?? {}) as SlackOk, 'Slack could not list custom emoji.'))
  }
  const raw = asRecord(payload.emoji) ?? {}
  const emoji: Record<string, string> = {}
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === 'string') emoji[name.toLowerCase()] = value
  }
  const metadata = asRecord(payload.response_metadata)
  const nextCursor = metadata && typeof metadata.next_cursor === 'string' ? metadata.next_cursor : ''
  return { emoji, nextCursor }
}

export async function slackListEmoji(token: string): Promise<Record<string, EmojiRecord>> {
  const merged: Record<string, string> = {}
  let cursor = ''
  do {
    const page = await slackEmojiPage(token, cursor)
    Object.assign(merged, page.emoji)
    cursor = page.nextCursor
  } while (cursor)
  return recordsFromSlackMap(merged, 'slack')
}

export function recordsFromSlackMap(
  emoji: Record<string, string>,
  cachePrefix: string,
): Record<string, EmojiRecord> {
  const records: Record<string, EmojiRecord> = {}
  for (const [name, value] of Object.entries(emoji)) {
    const normalized = name.toLowerCase()
    if (!/^[a-z0-9_+-]{1,100}$/.test(normalized)) continue
    if (value.startsWith('alias:')) {
      const aliasOf = value.slice('alias:'.length).toLowerCase()
      records[normalized] = {
        name: normalized,
        animated: false,
        url: '',
        cacheKey: '',
        aliasOf,
      }
      continue
    }
    records[normalized] = {
      name: normalized,
      animated: /\.gif($|\?)/i.test(value),
      url: value,
      cacheKey: `${cachePrefix}:${normalized}`,
    }
  }
  return records
}

export type SlackTokenResponse = {
  accessToken: string
  userId: string
  teamId: string
  teamName: string
}

export function readSlackTokenResponse(payload: unknown): SlackTokenResponse {
  const record = asRecord(payload)
  if (!record || record.ok !== true) {
    const error = record && typeof record.error === 'string' ? record.error : 'Slack did not return a token.'
    if (error === 'invalid_client_secret' || error === 'bad_client_secret') {
      throw new Error(
        'Slack refused the sign-in because this app still expects a client secret. Enable PKCE on the Slack app, or paste a user token instead.',
      )
    }
    throw new Error(error)
  }
  const authed = asRecord(record.authed_user)
  const accessToken =
    (authed && typeof authed.access_token === 'string' && authed.access_token) ||
    (typeof record.access_token === 'string' ? record.access_token : '')
  if (!accessToken.startsWith('xoxp-') && !accessToken.startsWith('xoxb-')) {
    throw new Error('Slack did not return a user token. The app should request only the emoji:read user scope.')
  }
  const team = asRecord(record.team)
  const enterprise = asRecord(record.enterprise)
  const teamId =
    (team && typeof team.id === 'string' && team.id) ||
    (enterprise && typeof enterprise.id === 'string' && enterprise.id) ||
    ''
  const teamName =
    (team && typeof team.name === 'string' && team.name) ||
    (enterprise && typeof enterprise.name === 'string' && enterprise.name) ||
    'Slack workspace'
  const userId = authed && typeof authed.id === 'string' ? authed.id : ''
  if (!teamId) throw new Error('Slack did not say which workspace was connected.')
  return { accessToken, userId, teamId, teamName }
}
