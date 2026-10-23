export type BackspaceBehavior = 'delete' | 'unwrap'

export type KeyboardScope = 'everywhere' | 'matched-sites'

export type ConnectionStatus = 'ready' | 'needs-auth' | 'error'

export type Settings = {
  backspace: BackspaceBehavior
  keyboardScope: KeyboardScope
  showStandardEmoji: boolean
  slackClientId: string
  discordClientId: string
  discordBotToken: string
  teamsClientId: string
}

/** A custom emoji after alias chains have been stored, before they are resolved. */
export type EmojiRecord = {
  name: string
  animated: boolean
  /** Remote image URL, a data URL, or empty when the bytes live in the image cache. */
  url: string
  cacheKey: string
  aliasOf?: string
}

type ConnectionBase = {
  id: string
  label: string
  status: ConnectionStatus
  statusDetail: string
  emoji: Record<string, EmojiRecord>
  syncedAt: number
}

export type SlackConnection = ConnectionBase & {
  kind: 'slack'
  teamId: string
  userId: string
  accessToken: string
}

export type DiscordConnection = ConnectionBase & {
  kind: 'discord'
  guildId: string
}

export type TeamsConnection = ConnectionBase & {
  kind: 'teams'
  tenantId: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export type Connection = SlackConnection | DiscordConnection | TeamsConnection

export type DiscordUser = {
  userId: string
  username: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export type DiscordGuildChoice = {
  id: string
  name: string
}

export type SiteRule = {
  id: string
  /** URL glob. `*` matches any characters, including slashes. */
  pattern: string
  /** Connection ids in the order they should be searched. */
  sourceIds: string[]
}

export type ExtensionState = {
  settings: Settings
  connections: Connection[]
  rules: SiteRule[]
  discordUser: DiscordUser | null
  discordGuilds: DiscordGuildChoice[]
}

export type ImageEmoji = {
  kind: 'image'
  name: string
  animated: boolean
  url: string
  cacheKey: string
  sourceLabel: string
}

export type NativeEmoji = {
  kind: 'native'
  name: string
  native: string
  label: string
}

export type ResolvedEmoji = ImageEmoji | NativeEmoji

export type KeyboardItem =
  | {
      kind: 'custom'
      name: string
      label: string
      image: ImageEmoji
    }
  | {
      kind: 'standard'
      name: string
      label: string
      native: string
    }

export const STORAGE_KEY = 'emoji-state'

export const DEFAULT_SETTINGS: Settings = {
  backspace: 'delete',
  keyboardScope: 'everywhere',
  showStandardEmoji: true,
  slackClientId: '',
  discordClientId: '',
  discordBotToken: '',
  teamsClientId: '',
}

export function emptyState(): ExtensionState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    connections: [],
    rules: [],
    discordUser: null,
    discordGuilds: [],
  }
}
