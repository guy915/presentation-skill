// npm run deploy [-- --dry-run] [--site-repo <owner/name>]
// Publishes a clean build to GitHub Pages as a fresh commit on a `gh-pages`
// branch (no Actions needed): the talk repo's own by default, or a separate
// public repo with --site-repo (for plans that can't serve Pages from a
// private repo). The build comes from HEAD's committed files, plus the
// gitignored public/media/ clips and public/rest/ stills. Adds <meta name="robots" content="noindex">,
// and writes a relative og:image or og:url as the absolute URL it publishes to
// (link previews need one), in a dry run too.
// Pages must serve the gh-pages branch root, which holds only the build.
// Refuses files over 95 MB (GitHub's limit is 100 MB); warns past 900 MB (Pages allows 1 GB).
// The build carries the notes: the speaker view reads them from the link.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";

const { values: o } = parseArgs({ options: { "dry-run": { type: "boolean" }, "site-repo": { type: "string" } } });
const dry = o["dry-run"];
const MAX_FILE = 95e6;
const WARN_SITE = 900e6;
const git = (...a: string[]) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const tryGit = (...a: string[]) => { try { return git(...a); } catch { return ""; } };

const root = tryGit("rev-parse", "--show-toplevel");
if (!root && !dry) throw new Error("deploy needs a git repository with a commit (dry runs build the working tree)");
const origin = root ? tryGit("remote", "get-url", "origin") : "";
const slug = o["site-repo"] ?? origin.match(/github\.com[:/]([^/]+\/[^/.]+?)(\.git)?$/)?.[1];
const remote = o["site-repo"] ? `https://github.com/${o["site-repo"]}.git` : origin;
const pagesUrl = slug ? (([owner, name]: string[]) => (name.toLowerCase() === `${owner.toLowerCase()}.github.io` ? `https://${owner}.github.io/` : `https://${owner}.github.io/${name}/`))(slug.split("/")) : "";
const url = pagesUrl || "(unknown: no GitHub origin; pass --site-repo)";

/** A relative og:image or og:url in `html`, as an absolute URL under `base`
 *  (a leading / is the talk's root, not the host's); each one written goes on `wrote`. */
const absoluteOg = (html: string, base: string, wrote: string[]) =>
  html.replace(/<meta\b[^>]*>/gi, (tag) => {
    const prop = tag.match(/\b(?:property|name)\s*=\s*["'](og:image|og:url)["']/i)?.[1];
    const content = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i);
    if (!prop || !content || /^([a-z][\w+.-]*:|\/\/)/i.test(content[2])) return tag;
    const abs = new URL(content[2].replace(/^\//, ""), base).href;
    wrote.push(`${prop} ${abs}`);
    return tag.replace(content[0], `content=${content[1]}${abs}${content[1]}`);
  });

// ---- clean build ------------------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), "talk-deploy-"));
const site = join(tmp, "site");
try {
  const commit = root ? git("rev-parse", "--short", "HEAD") : "(working tree)";
  let src = process.cwd();
  if (root) {
    src = join(tmp, "src");
    execFileSync("sh", ["-c", `mkdir -p "${src}" && git archive HEAD | tar -x -C "${src}"`], { cwd: root });
    symlinkSync(resolve("node_modules"), join(src, "node_modules"));
  }
  execFileSync("npx", ["vite", "build", "--logLevel", "error", "--outDir", site, "--emptyOutDir"], { cwd: src, stdio: "inherit" });
  // gitignored, shipped here only; dereference: a worktree may symlink it
  for (const d of ["media", "rest"]) if (existsSync(`public/${d}`)) cpSync(`public/${d}`, join(site, d), { recursive: true, dereference: true });
  const og: string[] = [];
  for (const f of readdirSync(site).filter((f) => f.endsWith(".html"))) {
    const p = join(site, f);
    const html = readFileSync(p, "utf8").replace("<head>", '<head>\n    <meta name="robots" content="noindex" />');
    const wrote: string[] = [];
    writeFileSync(p, pagesUrl ? absoluteOg(html, pagesUrl, wrote) : html);
    og.push(...wrote.map((w) => `${f} ${w}`));
  }
  writeFileSync(join(site, ".nojekyll"), "");

  // ---- sizes ------------------------------------------------------------------
  const files: { path: string; size: number }[] = [];
  const walk = (d: string): void => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : files.push({ path: relative(site, join(d, e.name)), size: statSync(join(d, e.name)).size })));
  walk(site);

  const total = files.reduce((a, f) => a + f.size, 0);
  const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;
  const big = files.filter((f) => f.size > MAX_FILE);

  console.log(`${dry ? "DRY RUN: would publish" : "Publishing"} build of ${commit}`);
  console.log(`  to      ${remote || "(no origin remote)"}  branch gh-pages (force-pushed, one commit, build only)`);
  console.log(`  files   ${files.length}, ${mb(total)}:`);
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) console.log(`          ${f.path.padEnd(48)} ${mb(f.size)}`);
  console.log(`  robots  noindex added to ${files.filter((f) => f.path.endsWith(".html")).map((f) => f.path).join(", ")}`);
  for (const line of og) console.log(`  og      ${line}`);
  console.log(`  url     ${url}`);
  if (total > WARN_SITE) console.warn(`WARNING: the site is ${mb(total)}; GitHub Pages allows 1 GB.`);
  if (big.length) {
    console.error(`REFUSED: GitHub rejects files over 100 MB; these are over ${mb(MAX_FILE)}:\n${big.map((f) => `  ${f.path} ${mb(f.size)}`).join("\n")}\nRe-encode them smaller (npm run media:fetch caps at 1440p) or trim them.`);
    process.exit(1);
  }
  if (dry) process.exit(0);
  if (!remote) throw new Error("no origin remote: add one, or pass --site-repo <owner/name>");

  const name = tryGit("config", "user.name") || "talk";
  const email = tryGit("config", "user.email") || "talk@localhost";
  const g = (...a: string[]) => execFileSync("git", ["-c", `user.name=${name}`, "-c", `user.email=${email}`, ...a], { cwd: site, stdio: "inherit" });
  g("init", "-q", "-b", "gh-pages");
  g("add", "-A");
  g("commit", "-qm", `Talk build ${commit}`);
  g("push", "-q", "-f", remote, "gh-pages");
  console.log(`Pushed. Set Pages to serve branch gh-pages, folder / (once). Live in about a minute: ${url}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
