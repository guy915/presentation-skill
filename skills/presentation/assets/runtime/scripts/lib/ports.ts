// Every port the project uses, from one base, so parallel worktrees don't
// collide: TALK_PORT_BASE=4710 npm test. Erasable TS: Node imports it directly.
const base = Number(process.env.TALK_PORT_BASE ?? 4610);

export const ports = {
  test: base, // vite preview of the build, for npm test and npm run preview
  dev: base + 1, // npm run dev
  scripts: base + 2, // shots, screening, handout
};
