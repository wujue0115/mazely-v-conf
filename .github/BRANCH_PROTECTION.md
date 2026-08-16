# Recommended Repository Rules

Configure a branch ruleset for `main` in GitHub. The checked-in files document
the intended policy, but GitHub repository settings must also be configured for
the policy to be enforced.

## `main`

- Block direct pushes and force pushes.
- Require a pull request before merging.
- Require at least one approval.
- Dismiss stale approvals after new commits are pushed.
- Require all conversations to be resolved.
- Require branches to be up to date before merging.
- Require the GitHub Actions check `Quality`.
- Prefer squash merge or rebase merge to keep a linear history.
- Restrict branch deletion.

Require the `Quality` check defined in `.github/workflows/ci.yml`. Cloudflare
Pages Preview checks should remain optional because a preview may not be created
for changes excluded by the project's build watch paths.

## Working Branches

Use short-lived `feat/*`, `fix/*`, `docs/*`, `test/*`, or `chore/*` branches.
They may receive normal pushes and produce Cloudflare Preview deployments. All
changes reach production through a pull request into `main`.

Delete working branches after their pull requests are merged.

