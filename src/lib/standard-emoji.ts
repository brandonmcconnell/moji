import compactData from 'emojibase-data/en/compact.json'
import githubShortcodes from 'emojibase-data/en/shortcodes/github.json'
import type { NativeEmoji } from './types'

type CompactEmoji = {
  hexcode: string
  unicode: string
  label: string
  group?: number
  tags?: string[]
}

type ShortcodeValue = string | string[]

const GROUP_LABELS: Record<number, string> = {
  0: 'Smileys & Emotion',
  1: 'People & Body',
  3: 'Animals & Nature',
  4: 'Food & Drink',
  5: 'Travel & Places',
  6: 'Activities',
  7: 'Objects',
  8: 'Symbols',
  9: 'Flags',
}

const GROUP_ORDER = [0, 1, 3, 4, 5, 6, 7, 8, 9] as const

export type StandardCategory = {
  id: string
  label: string
  emoji: NativeEmoji[]
}

type IndexedEmoji = NativeEmoji & {
  tags: readonly string[]
  group: number
}

const shortcodes = githubShortcodes as Record<string, ShortcodeValue>
const compact = compactData as CompactEmoji[]

function namesFor(hexcode: string): string[] {
  const value = shortcodes[hexcode]
  if (typeof value === 'string') return [value.toLowerCase()]
  if (Array.isArray(value)) return value.map((name) => name.toLowerCase())
  return []
}

function isSkinVariant(hexcode: string): boolean {
  return /-1F3F[B-F](?:-|$)/.test(hexcode)
}

const byName = new Map<string, IndexedEmoji>()
const grouped = new Map<number, IndexedEmoji[]>()

for (const entry of compact) {
  if (entry.group === undefined || !(entry.group in GROUP_LABELS)) continue
  const names = namesFor(entry.hexcode)
  const primary = names[0]
  if (!primary || !entry.unicode) continue
  const emoji: IndexedEmoji = {
    kind: 'native',
    name: primary,
    native: entry.unicode,
    label: entry.label,
    tags: entry.tags ?? [],
    group: entry.group,
  }
  for (const name of names) {
    if (!byName.has(name)) byName.set(name, { ...emoji, name })
  }
  if (isSkinVariant(entry.hexcode)) continue
  const list = grouped.get(entry.group) ?? []
  list.push(emoji)
  grouped.set(entry.group, list)
}

const categories: StandardCategory[] = GROUP_ORDER.map((group) => ({
  id: String(group),
  label: GROUP_LABELS[group] ?? 'Emoji',
  emoji: grouped.get(group) ?? [],
}))

export function standardCategories(): readonly StandardCategory[] {
  return categories
}

export function standardByName(name: string): NativeEmoji | null {
  const found = byName.get(name.toLowerCase())
  if (!found) return null
  return { kind: 'native', name: found.name, native: found.native, label: found.label }
}

export function searchStandard(query: string, limit: number): NativeEmoji[] {
  const needle = query.toLowerCase()
  if (!needle) return []
  const ranked: { emoji: IndexedEmoji; score: number }[] = []
  const seen = new Set<string>()
  for (const emoji of byName.values()) {
    if (seen.has(emoji.native)) continue
    let score = 0
    if (emoji.name === needle) score = 0
    else if (emoji.name.startsWith(needle)) score = 1
    else if (emoji.label.toLowerCase().startsWith(needle)) score = 2
    else if (emoji.name.includes(needle) || emoji.label.toLowerCase().includes(needle)) score = 3
    else if (emoji.tags.some((tag) => tag.includes(needle))) score = 4
    else continue
    seen.add(emoji.native)
    ranked.push({ emoji, score })
  }
  ranked.sort((a, b) => a.score - b.score || a.emoji.name.localeCompare(b.emoji.name))
  return ranked.slice(0, limit).map((item) => ({
    kind: 'native',
    name: item.emoji.name,
    native: item.emoji.native,
    label: item.emoji.label,
  }))
}

export const standardLookup = {
  byName: standardByName,
  search: searchStandard,
  categories: () =>
    categories.map((category) => ({
      id: category.id,
      label: category.label,
      emoji: category.emoji,
    })),
}
