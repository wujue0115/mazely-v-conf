# Contributing Guide

This repository uses `main` as the production source for the V-CONF demo and
short-lived branches for all changes. Do not develop or commit directly on
`main`.

## Branching Model

- `main`: protected, releasable, and deployed to production.
- `feat/<topic>`: user-facing features.
- `fix/<topic>`: bug fixes.
- `docs/<topic>`: documentation-only changes.
- `test/<topic>`: test-only changes.
- `chore/<topic>`: maintenance, dependencies, and tooling.

Keep branches focused and delete them after their pull requests are merged.

## Development Flow

1. Update local `main` and create a short-lived branch from it.
2. Make focused changes and add or update tests when behavior changes.
3. Run the local checks relevant to the change:

```bash
pnpm type-check
pnpm lint
pnpm test:unit --run
pnpm build-only
```

For changes that affect browser behavior, also run:

```bash
pnpm test:e2e --project=chromium
```

4. Open a pull request targeting `main`.
5. Review the Cloudflare Pages Preview deployment when the UI or deployment
   output changes.
6. Merge only after the required `Quality` check passes and review feedback is
   resolved.

Merges to `main` trigger the production deployment for
[`v-conf.mazely.dev`](https://v-conf.mazely.dev).

## Commit Message Convention

Use Conventional Commits, with a scope when it makes the change clearer.

- `feat(app): add X`
- `fix(maze): correct Y`
- `docs: explain Z`
- `test(app): cover X`
- `chore(repo): update CI`

Pull request titles should follow the same convention because the repository
uses squash or rebase merges to keep a linear history.

## Pull Request Checklist

- [ ] The change is focused and documented.
- [ ] Tests were added or updated when behavior changed.
- [ ] Relevant local checks pass.
- [ ] The pull request title follows Conventional Commits.
- [ ] The Cloudflare Preview was reviewed when applicable.

