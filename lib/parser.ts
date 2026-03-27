import type { ParsedInput } from './types';

/**
 * Global Parsing Engine
 * Parses strings like "@ahmet #backend önemli bir görev @elif"
 * into structured data for routing to correct DB tables.
 */
export function parseMagicInput(input: string): ParsedInput {
  const mentions: string[] = [];
  const tags: string[] = [];

  // Extract @mentions (person names)
  const mentionRegex = /@(\w+)/g;
  let match;
  while ((match = mentionRegex.exec(input)) !== null) {
    mentions.push(match[1].toLowerCase());
  }

  // Extract #tags (project/label tags)
  const tagRegex = /#(\w+)/g;
  while ((match = tagRegex.exec(input)) !== null) {
    tags.push(match[1].toLowerCase());
  }

  // Clean text: remove @mentions and #tags
  const text = input
    .replace(/@\w+/g, '')
    .replace(/#\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    text,
    mentions,
    tags,
    projectRef: tags[0], // First tag is treated as project reference
  };
}

/**
 * Get current ISO week number
 */
export function getWeekNumber(date: Date = new Date()): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
    year: d.getUTCFullYear(),
  };
}

/**
 * Get the Monday date of a given ISO week
 */
export function getWeekMonday(week: number, year: number): Date {
  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
  const monday = new Date(startOfWeek1);
  monday.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}
