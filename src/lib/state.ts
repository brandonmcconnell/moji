import {
  emptyState,
  type Connection,
  type DiscordConnection,
  type DiscordGuildChoice,
  type DiscordUser,
  type EmojiRecord,
  type ExtensionState,
  type Settings,
  type SiteRule,
  type SlackConnection,
  type TeamsConnection,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function timestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function settingsFrom(value: unknown): Settings {
  const defaults = emptyState().settings
  if (!isRecord(value)) return defaults
  const backspace = value.backspace === 'unwrap' ? 'unwrap' : 'delete'
  const keyboardScope = value.keyboardScope === 'matched-sites' ? 'matched-sites' : 'everywhere'
  return {
    backspace,
    keyboardScope,
    showStandardEmoji: value.showStandardEmoji !== false,
    slackClientId: text(value.slackClientId),
    discordClientId: text(value.discordClientId),
    discordBotToken: text(value.discordBotToken),
    teamsClientId: text(value.teamsClientId),
  }
}

function emojiMap(value: unknown): Record<string, EmojiRecord> {
  if (!isRecord(value)) return {}
  const emoji: Record<string, EmojiRecord> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue
    const name = text(entry.name, key).toLowerCase()
    if (!/^[a-z0-9_+-]{1,100}$/.test(name)) continue
    const record: EmojiRecord = {
      name,
      animated: entry.animated === true,
      url: text(entry.url),
      cacheKey: text(entry.cacheKey, `${name}`),
    }
    const aliasOf = text(entry.aliasOf).toLowerCase()
    if (aliasOf) record.aliasOf = aliasOf
    emoji[name] = record
  }
  return emoji
}

function statusOf(value: unknown): Connection['status'] {
  if (value === 'needs-auth' || value === 'error' || value === 'ready') return value
  return 'ready'
}

function connectionFrom(value: unknown): Connection | null {
  if (!isRecord(value)) return null
  const kind = value.kind
  const base = {
    id: text(value.id),
    label: text(value.label),
    status: statusOf(value.status),
    statusDetail: text(value.statusDetail),
    emoji: emojiMap(value.emoji),
    syncedAt: timestamp(value.syncedAt),
  }
  if (!base.id) return null
  if (kind === 'slack') {
    const teamId = text(value.teamId)
    const accessToken = text(value.accessToken)
    if (!teamId || !accessToken) return null
    const connection: SlackConnection = {
      ...base,
      kind: 'slack',
      teamId,
      userId: text(value.userId),
      accessToken,
    }
    return connection
  }
  if (kind === 'discord') {
    const guildId = text(value.guildId)
    if (!guildId) return null
    const connection: DiscordConnection = { ...base, kind: 'discord', guildId }
    return connection
  }
  if (kind === 'teams') {
    const tenantId = text(value.tenantId)
    const accessToken = text(value.accessToken)
    if (!tenantId || !accessToken) return null
    const connection: TeamsConnection = {
      ...base,
      kind: 'teams',
      tenantId,
      accessToken,
      refreshToken: text(value.refreshToken),
      expiresAt: timestamp(value.expiresAt),
    }
    return connection
  }
  return null
}

function rulesFrom(value: unknown): SiteRule[] {
  if (!Array.isArray(value)) return []
  const rules: SiteRule[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    const id = text(entry.id)
    const pattern = text(entry.pattern).trim()
    if (!id || !pattern) continue
    const sourceIds = Array.isArray(entry.sourceIds)
      ? entry.sourceIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
    rules.push({ id, pattern, sourceIds })
  }
  return rules
}

function discordUserFrom(value: unknown): DiscordUser | null {
  if (!isRecord(value)) return null
  const userId = text(value.userId)
  const accessToken = text(value.accessToken)
  if (!userId || !accessToken) return null
  return {
    userId,
    username: text(value.username),
    accessToken,
    refreshToken: text(value.refreshToken),
    expiresAt: timestamp(value.expiresAt),
  }
}

function guildsFrom(value: unknown): DiscordGuildChoice[] {
  if (!Array.isArray(value)) return []
  const guilds: DiscordGuildChoice[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    const id = text(entry.id)
    const name = text(entry.name)
    if (!id || !name) continue
    guilds.push({ id, name })
  }
  return guilds
}

export function normalizeState(value: unknown): ExtensionState {
  if (!isRecord(value)) return emptyState()
  const connections = Array.isArray(value.connections)
    ? value.connections.flatMap((entry) => {
        const connection = connectionFrom(entry)
        return connection ? [connection] : []
      })
    : []
  return {
    settings: settingsFrom(value.settings),
    connections,
    rules: rulesFrom(value.rules),
    discordUser: discordUserFrom(value.discordUser),
    discordGuilds: guildsFrom(value.discordGuilds),
  }
}

export function connectionById(state: ExtensionState, id: string): Connection | null {
  return state.connections.find((connection) => connection.id === id) ?? null
}
