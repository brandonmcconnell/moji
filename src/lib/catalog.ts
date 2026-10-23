import { matchUrlPattern } from './pattern'
import type {
  Connection,
  EmojiRecord,
  ExtensionState,
  ImageEmoji,
  KeyboardItem,
  NativeEmoji,
  ResolvedEmoji,
} from './types'

export type StandardLookup = {
  byName: (name: string) => NativeEmoji | null
  search: (query: string, limit: number) => NativeEmoji[]
  categories: () => readonly { id: string; label: string; emoji: NativeEmoji[] }[]
}

export function resolveAlias(
  emoji: Record<string, EmojiRecord>,
  name: string,
): EmojiRecord | null {
  const seen = new Set<string>()
  let current = emoji[name]
  while (current) {
    if (!current.aliasOf) return current
    if (seen.has(current.name)) return null
    seen.add(current.name)
    current = emoji[current.aliasOf]
  }
  return null
}

function matchingConnections(state: ExtensionState, url: string): Connection[] {
  const ordered: Connection[] = []
  const seen = new Set<string>()
  for (const rule of state.rules) {
    if (!matchUrlPattern(rule.pattern, url)) continue
    for (const sourceId of rule.sourceIds) {
      if (seen.has(sourceId)) continue
      const connection = state.connections.find((item) => item.id === sourceId)
      if (!connection) continue
      seen.add(sourceId)
      ordered.push(connection)
    }
  }
  return ordered
}

export function pageAllowsStandard(state: ExtensionState, url: string): boolean {
  if (!state.settings.showStandardEmoji) return false
  if (state.settings.keyboardScope === 'everywhere') return true
  return state.rules.some((rule) => matchUrlPattern(rule.pattern, url))
}

export function pageHasCustomSource(state: ExtensionState, url: string): boolean {
  return matchingConnections(state, url).length > 0
}

export function customEmojiForPage(state: ExtensionState, url: string): ImageEmoji[] {
  const seen = new Set<string>()
  const emoji: ImageEmoji[] = []
  for (const connection of matchingConnections(state, url)) {
    for (const record of Object.values(connection.emoji)) {
      if (seen.has(record.name)) continue
      const resolved = resolveAlias(connection.emoji, record.name)
      if (!resolved || resolved.aliasOf) continue
      seen.add(record.name)
      emoji.push({
        kind: 'image',
        name: record.name,
        animated: resolved.animated,
        url: resolved.url,
        cacheKey: resolved.cacheKey,
        sourceLabel: connection.label,
      })
    }
  }
  emoji.sort((a, b) => a.name.localeCompare(b.name))
  return emoji
}

export function resolveEmoji(
  state: ExtensionState,
  url: string,
  name: string,
  standard: StandardLookup,
): ResolvedEmoji | null {
  const normalized = name.toLowerCase()
  for (const connection of matchingConnections(state, url)) {
    const resolved = resolveAlias(connection.emoji, normalized)
    if (!resolved || resolved.aliasOf) continue
    return {
      kind: 'image',
      name: normalized,
      animated: resolved.animated,
      url: resolved.url,
      cacheKey: resolved.cacheKey,
      sourceLabel: connection.label,
    }
  }
  if (!pageAllowsStandard(state, url)) return null
  return standard.byName(normalized)
}

export function keyboardItems(
  state: ExtensionState,
  url: string,
  query: string,
  standard: StandardLookup,
): KeyboardItem[] {
  const custom = customEmojiForPage(state, url)
  const needle = query.toLowerCase()
  const customItems: KeyboardItem[] = custom
    .filter((emoji) => needle.length === 0 || emoji.name.includes(needle))
    .slice(0, 80)
    .map((emoji) => ({
      kind: 'custom',
      name: emoji.name,
      label: emoji.sourceLabel,
      image: emoji,
    }))
  if (!pageAllowsStandard(state, url)) return customItems
  if (needle.length === 0) return customItems
  const standardItems: KeyboardItem[] = standard.search(needle, 60).map((emoji) => ({
    kind: 'standard',
    name: emoji.name,
    label: emoji.label,
    native: emoji.native,
  }))
  return [...customItems, ...standardItems].slice(0, 80)
}
