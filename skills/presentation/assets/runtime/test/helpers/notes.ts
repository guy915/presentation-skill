// Build history in spoken notes: the talk's own versions, QA rounds, ADRs,
// working files and commits. Ordinary version numbers, issue numbers and
// words like "committed" are content in a talk about software (or a eulogy), not history.
import { execFileSync } from "node:child_process";

export interface Repo {
  tags: string[]; // the talk repo's git tags
  commits: string[]; // its full commit hashes
}

const HISTORY = [
  /\b[vV]\d+(\.\d+)*\b/, // v2, V6.1: how a talk names its own versions
  /\b(?:version \d+|(?:first|second|third|previous|last|earlier|old|new|next) (?:version|build|draft|iteration|revision|pass|cut)) of (?:this|the|our) (?:slide|talk|deck|beat|scene|section|script|notes|visual)s?\b/i,
  /\b(?:gate|round) \d+\b/i,
  /\b(?:critique|critic|red-?team|review(?:er)?) (?:round|pass|said|flagged|verdict|score)\b/i,
  /\bADR[- ]?\d+\b/i,
  /\bchangelog\b/i,
  /\b(?:BRIEF|CLAIMS|PROGRESS|MATERIALS|CHANGELOG|treatment)\.md\b/,
  /\b(?:FIXME|in the last build)\b/i,
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The talk repo's tags and commits, or none outside a git checkout. */
export function repo(): Repo {
  const git = (...args: string[]) => {
    try {
      return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
    } catch {
      return [];
    }
  };
  return { tags: git("tag"), commits: git("log", "--all", "--format=%H") };
}

/** What in `notes` reads as build history; phrases in `allow` are exempt. */
export function leaks(notes: string, { tags, commits }: Repo, allow: Record<string, string> = {}): string[] {
  let text = notes;
  for (const phrase of Object.keys(allow)) text = text.split(phrase).join(" ");
  const found = HISTORY.flatMap((re) => text.match(re)?.[0] ?? []);
  for (const t of tags) found.push(...(text.match(new RegExp(`(?<![\\w-])${escape(t)}(?![\\w-])`)) ?? []));
  for (const h of text.match(/\b[0-9a-f]{7,40}\b/g) ?? []) if (commits.some((c) => c.startsWith(h))) found.push(h);
  return found;
}
