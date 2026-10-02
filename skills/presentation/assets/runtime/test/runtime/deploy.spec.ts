// `npm run deploy -- --dry-run`, in a throwaway git copy of this project
// with a fake GitHub origin (nothing is pushed): committed files plus the
// gitignored clips (a worktree's symlinked public/media as real files),
// noindex, the Pages URL, a relative og:image and og:url made absolute at it,
// and the 95 MB refusal.
import { test, expect } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// outside the project: a copy can't live inside what it copies
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "talk-deploy-test-"));
  dirs.push(dir);
  cpSync(resolve("."), dir, { recursive: true, filter: (p) => !/\/(node_modules|dist|out|test-results|\.git)(\/|$)/.test(p) });
  // link-preview tags as a talk writes them before it has a URL
  const index = resolve(dir, "index.html");
  writeFileSync(index, readFileSync(index, "utf8").replace("</title>", '</title>\n    <meta property="og:image" content="share.jpg" />\n    <meta property="og:url" content="./" />'));
  writeFileSync(resolve(dir, "public/share.jpg"), "jpg");
  symlinkSync(resolve("node_modules"), resolve(dir, "node_modules"));
  // the skill ships the runtime's ignore file as `gitignore`; a talk has it as .gitignore
  if (existsSync(resolve(dir, "gitignore"))) renameSync(resolve(dir, "gitignore"), resolve(dir, ".gitignore"));
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("remote", "add", "origin", "git@github.com:someone/my-talk.git");
  git("add", "-A");
  git("commit", "-qm", "talk");
  // public/media as a worktree has it: a link to a shared folder
  const shared = mkdtempSync(join(tmpdir(), "talk-media-"));
  dirs.push(shared);
  writeFileSync(resolve(shared, "clip.mp4"), "x".repeat(1000));
  mkdirSync(resolve(dir, "public"), { recursive: true });
  symlinkSync(shared, resolve(dir, "public/media"));
  writeFileSync(resolve(dir, "public/uncommitted.txt"), "not in HEAD");
  return dir;
}
const dirs: string[] = [];
test.afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
/** The environment without the fixture knobs (playwright.config.ts): deploy builds the copy as a talk would. */
const plain = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^TALK_(BEATS|SECTIONS|PUBLIC)$/.test(k)));
const deploy = (dir: string, ...args: string[]) =>
  spawnSync("node", ["scripts/deploy.ts", "--dry-run", ...args], { cwd: dir, encoding: "utf8", env: plain() });

test("dry run: builds HEAD plus the gitignored clips as real files, adds noindex, prints target and URL, pushes nothing", async () => {
  test.setTimeout(120_000);
  const dir = repo();
  const r = deploy(dir);
  expect(r.status, r.stderr).toBe(0);
  expect(r.stdout).toMatch(/DRY RUN: would publish build of [0-9a-f]{7}/);
  expect(r.stdout).toMatch(/(git@github\.com:|https:\/\/github\.com\/)someone\/my-talk\.git  branch gh-pages/); // git may rewrite the URL (url.insteadOf)
  expect(r.stdout).toContain("https://someone.github.io/my-talk/");
  expect(r.stdout).toContain("noindex added to index.html, presenter.html");
  expect(r.stdout).toContain("og      index.html og:image https://someone.github.io/my-talk/share.jpg\n");
  expect(r.stdout).toContain("og      index.html og:url https://someone.github.io/my-talk/\n");
  expect(r.stdout).toMatch(/media\/clip\.mp4\s+0\.0 MB/); // a 1000-byte file, not a link
  expect(r.stdout).not.toMatch(/^\s+media\s/m);
  expect(r.stdout).not.toContain("uncommitted.txt");
  expect(execFileSync("git", ["branch", "--list", "gh-pages"], { cwd: dir, encoding: "utf8" })).toBe("");
  const other = deploy(dir, "--site-repo", "someone/someone.github.io");
  expect(other.stdout).toContain("https://github.com/someone/someone.github.io.git  branch gh-pages");
  expect(other.stdout).toContain("url     https://someone.github.io/\n");
  expect(other.stdout).toContain("og      index.html og:image https://someone.github.io/share.jpg\n");
});

test("publishes the build to gh-pages with the og tags absolute at the Pages URL", async () => {
  test.setTimeout(120_000);
  const dir = repo();
  const bare = mkdtempSync(join(tmpdir(), "talk-pages-"));
  dirs.push(bare);
  execFileSync("git", ["init", "-q", "--bare", bare]);
  // the GitHub origin, pushed to a local bare repo instead (pushInsteadOf: its URL still reads as GitHub)
  const env = { ...plain(), GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: `url.${bare}.pushInsteadOf`, GIT_CONFIG_VALUE_0: "git@github.com:someone/my-talk.git" };
  const r = spawnSync("node", ["scripts/deploy.ts"], { cwd: dir, encoding: "utf8", env });
  expect(r.status, r.stderr).toBe(0);
  const html = execFileSync("git", ["show", "gh-pages:index.html"], { cwd: bare, encoding: "utf8" });
  expect(html).toContain('<meta property="og:image" content="https://someone.github.io/my-talk/share.jpg" />');
  expect(html).toContain('<meta property="og:url" content="https://someone.github.io/my-talk/" />');
  expect(html).toContain('<meta name="robots" content="noindex" />');
});

test("refuses a file over 95 MB", async () => {
  test.setTimeout(120_000);
  const dir = repo();
  truncateSync(resolve(dir, "public/media/clip.mp4"), 96e6); // sparse: instant
  const r = deploy(dir);
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/REFUSED.*\n\s+media\/clip\.mp4 96\.0 MB/);
});
