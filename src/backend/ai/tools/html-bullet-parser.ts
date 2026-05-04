/**
 * @fileoverview HTML Sidecar Bullet Parser
 *
 * Takes raw `ScrapeResult` from `BrowserRendering.scrapeElements()` (headings + list items)
 * and correlates them into classified groups. This provides ground-truth DOM content
 * for comparison against AI-extracted bullets.
 *
 * The classification uses heading keyword matching to map each group to a
 * `RoleBulletType` from the schema.
 */

import type { RoleBulletType } from "../../db/schemas/role-bullets";
import type { ScrapeResult, ScrapeResultItem } from "./browser-rendering";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedBulletGroup = {
  /** Matched heading text */
  heading: string;
  /** Classified bullet type (null if no match) */
  type: RoleBulletType | null;
  /** Ordered list items under this heading */
  items: string[];
  /** Vertical position of the heading (for ordering) */
  topPosition: number;
};

// ---------------------------------------------------------------------------
// Heading → BulletType classification map
// ---------------------------------------------------------------------------

const HEADING_CLASSIFIERS: Array<{
  type: RoleBulletType;
  patterns: RegExp[];
}> = [
  {
    type: "KEY_RESPONSIBILITY",
    patterns: [
      /responsibilit/i,
      /what you('|')?ll do/i,
      /the role/i,
      /your role/i,
      /about the job/i,
      /job duties/i,
      /day.to.day/i,
    ],
  },
  {
    type: "REQUIRED_QUALIFICATION",
    patterns: [
      /minimum qualif/i,
      /required qualif/i,
      /basic qualif/i,
      /must have/i,
      /requirements$/i,
      /what we('|')?re looking for/i,
      /who you are/i,
    ],
  },
  {
    type: "PREFERRED_QUALIFICATION",
    patterns: [/preferred qualif/i, /nice to have/i, /bonus/i, /ideal/i, /additionally/i],
  },
  {
    type: "EDUCATION_REQUIREMENT",
    patterns: [/education/i, /degree/i, /academic/i],
  },
  {
    type: "REQUIRED_SKILL",
    patterns: [/required skill/i, /technical skill/i, /skills required/i, /core compet/i],
  },
  {
    type: "PREFERRED_SKILL",
    patterns: [/preferred skill/i, /additional skill/i],
  },
  {
    type: "BENEFIT",
    patterns: [
      /benefit/i,
      /perk/i,
      /compensation/i,
      /salary/i,
      /what we offer/i,
      /why join/i,
      /why work/i,
    ],
  },
];

function classifyHeading(headingText: string): RoleBulletType | null {
  for (const { type, patterns } of HEADING_CLASSIFIERS) {
    for (const pattern of patterns) {
      if (pattern.test(headingText)) return type;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse scraped DOM elements into classified bullet groups.
 *
 * Expects a `ScrapeResult` with two selector groups:
 * - `"h1, h2, h3"` — section headings
 * - `"ul > li"` — list items
 *
 * Groups are formed by associating each `<li>` with the nearest preceding heading
 * based on vertical position (`top` value from DOM bounding rect).
 */
export function classifyScrapedElements(elements: ScrapeResult): ParsedBulletGroup[] {
  if (!elements || elements.length === 0) return [];

  // Extract headings and list items from the scrape result
  const headingGroup = elements.find(
    (g) => g.selector.includes("h1") || g.selector.includes("h2") || g.selector.includes("h3"),
  );
  const listGroup = elements.find((g) => g.selector.includes("li"));

  if (!headingGroup || !listGroup) return [];

  const headings = headingGroup.results
    .filter((h) => h.text.trim().length > 0)
    .sort((a, b) => a.top - b.top);

  const listItems = listGroup.results
    .filter((li) => li.text.trim().length > 0)
    .sort((a, b) => a.top - b.top);

  if (headings.length === 0) return [];

  // Group list items by nearest preceding heading
  const groups: Map<string, { heading: ScrapeResultItem; items: ScrapeResultItem[] }> = new Map();

  for (const heading of headings) {
    const key = `${heading.top}:${heading.text}`;
    groups.set(key, { heading, items: [] });
  }

  const headingEntries = Array.from(groups.entries());

  for (const li of listItems) {
    // Find the heading immediately before this list item (by vertical position)
    let bestKey: string | null = null;
    let bestTop = -Infinity;

    for (const [key, group] of headingEntries) {
      if (group.heading.top <= li.top && group.heading.top > bestTop) {
        bestTop = group.heading.top;
        bestKey = key;
      }
    }

    if (bestKey) {
      groups.get(bestKey)!.items.push(li);
    }
  }

  // Convert to ParsedBulletGroup[]
  return Array.from(groups.values())
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      heading: g.heading.text.trim(),
      type: classifyHeading(g.heading.text),
      items: g.items.map((li) => li.text.trim()),
      topPosition: g.heading.top,
    }))
    .sort((a, b) => a.topPosition - b.topPosition);
}

/**
 * Flatten classified groups into a simple Record for quick comparison
 * against AI-extracted bullets keyed by type.
 */
export function groupedBulletsByType(
  groups: ParsedBulletGroup[],
): Partial<Record<RoleBulletType, string[]>> {
  const result: Partial<Record<RoleBulletType, string[]>> = {};

  for (const group of groups) {
    if (!group.type) continue;
    if (!result[group.type]) result[group.type] = [];
    result[group.type]!.push(...group.items);
  }

  return result;
}
