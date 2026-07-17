import { TRANSFERS, SOURCES } from "../data/transferPartners.js";

/**
 * Funding engine.
 *
 * Given an award priced in a specific loyalty program, work out every way
 * the user's balances can actually pay for it:
 *   - direct:   they already hold enough points in that program
 *   - transfer: a card currency they hold transfers to that program
 *               (in 1,000-point blocks, at the partner ratio)
 *
 * Returns paths sorted best-first: direct beats transfer, instant
 * transfers beat slow ones, cheaper card spend beats dearer.
 */
export function fundingPaths(programId, needed, balances) {
  const paths = [];

  if ((balances[programId] ?? 0) >= needed) {
    paths.push({ type: "direct", source: programId, srcPts: needed, days: 0 });
  }

  for (const [card, partners] of Object.entries(TRANSFERS)) {
    const p = partners[programId];
    if (!p) continue;
    const cardPts = Math.ceil(needed / p.r / 1000) * 1000; // 1K transfer blocks
    if ((balances[card] ?? 0) >= cardPts) {
      paths.push({ type: "transfer", source: card, srcPts: cardPts, ratio: p.r, days: p.d });
    }
  }

  paths.sort(
    (a, b) =>
      (a.type === "direct" ? 0 : 1) - (b.type === "direct" ? 0 : 1) ||
      a.days - b.days ||
      a.srcPts - b.srcPts
  );
  return paths;
}

/** Best single funding path, or null if the award is out of reach. */
export const bestPath = (programId, needed, balances) =>
  fundingPaths(programId, needed, balances)[0] ?? null;

/** Human-readable description of a funding path. */
export function describePath(path, programId) {
  if (!path) return "No funding path with current balances";
  const prog = SOURCES[programId]?.short ?? programId;
  if (path.type === "direct") {
    return `Book directly with ${path.srcPts.toLocaleString()} ${prog} points`;
  }
  const card = SOURCES[path.source]?.short ?? path.source;
  const speed = path.days === 0 ? "instant" : `~${path.days} day${path.days > 1 ? "s" : ""} — transfer early`;
  const ratio = path.ratio !== 1 ? ` at 1:${path.ratio}` : "";
  return `Transfer ${path.srcPts.toLocaleString()} ${card} → ${prog}${ratio} (${speed})`;
}
