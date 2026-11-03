<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- release-kit -->
## Commits and releases

- Write every commit message as a Conventional Commit: `type(scope): subject`, with type one of feat, fix, perf, security, refactor, docs, test, build, ci, chore, style, revert. A hook and a CI check reject anything else; see RELEASING.md.
- Use `feat` and `fix` only for changes a user would notice: they become the release notes and the public build log.
- Write those subjects as patch notes, for users: what they can now do or what works better, not the file, library or test you touched. When the subject must stay technical, add a `Release-note: <plain sentence>` line to the body, or `Release-note: skip` for a change no user would notice.
- Don't bump versions, edit CHANGELOG.md or create tags by hand: `npm run release` does all three.
- Land changes through pull requests: a pre-push hook blocks pushing straight to main or a release branch, force pushes and moving release tags. Don't get around it with `--no-verify` or `RELEASE_KIT_ALLOW_DIRECT_PUSH=1` (that is for emergencies the owner asks for, and a Direct push alarm reports it either way).
<!-- /release-kit -->

## Bundler: Turbopack everywhere

- Dev servers and tests run on Turbopack; never add `--webpack` to `next dev`, and never cap the heap (`NODE_OPTIONS=--max-old-space-size`): a capped heap makes Next restart and fail requests instead of saving memory.
- Production builds (`npm run build`, `npm run build:e2e`, `npm run build:worker`) run on Turbopack too (owner decision, 2026-11-01): nothing here needs webpack, and the postbuild bypass check (`scripts/check-no-dev-bypass.mjs`) scans Turbopack's output the same way.
  Add `--webpack` back only for something that genuinely needs it, and write the reason here.
- Measured on 2026-11-01 (all 13 pages visited): `next dev` on webpack held 2.4 GB, on Turbopack 1.8 GB, and each page compiled in about 0.3 s instead of 1 to 3 s.
- A worktree needs its own `npm ci`: Turbopack refuses a `node_modules` symlinked from outside the project.
