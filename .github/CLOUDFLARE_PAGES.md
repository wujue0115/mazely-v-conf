# Cloudflare Workers Builds Configuration

This project follows the current Mazely Studio deployment model: GitHub Actions
validates changes, while [Cloudflare Workers Builds][workers-builds] builds and
deploys the site through its GitHub integration. GitHub Actions does not deploy
the application.

## GitHub integration

Install the **Cloudflare Workers and Pages** GitHub App for the `wujue0115`
account and grant it access to `wujue0115/mazely-v-conf`. In Cloudflare, connect
the existing `mazely-v-conf` Worker to that repository under
**Settings → Builds**.

The Worker name must match the `name` in `wrangler.jsonc`. If the repository is
not available when configuring the build, update the GitHub App's repository
access before reconnecting it in Cloudflare.

## Project settings

| Setting                              | Value                                          |
| ------------------------------------ | ---------------------------------------------- |
| Worker name                          | `mazely-v-conf`                                |
| Git repository                       | `wujue0115/mazely-v-conf`                      |
| Production branch                    | `main`                                         |
| Builds for non-production branches   | Enabled                                        |
| Root directory                       | Repository root (blank or `/`)                 |
| Build command                        | `pnpm install --frozen-lockfile && pnpm build` |
| Deploy command                       | `npx wrangler deploy`                          |
| Non-production branch deploy command | `npx wrangler versions upload`                 |
| Custom domain                        | `v-conf.mazely.dev`                            |
| `NODE_VERSION`                       | `24`                                           |
| `PNPM_VERSION`                       | `10.28.0`                                      |
| `SKIP_DEPENDENCY_INSTALL`            | `1`                                            |

`SKIP_DEPENDENCY_INSTALL=1` avoids a separate implicit install. The build
command performs one reproducible frozen install instead.

The production deploy command promotes the uploaded version. For any branch
other than `main`, Workers Builds replaces it with the non-production command,
which uploads a version without promoting it and provides a Preview URL.

## Deployment behavior

| Event                               | GitHub Actions | Cloudflare Workers Builds                 |
| ----------------------------------- | -------------- | ----------------------------------------- |
| Push to a branch with an open PR    | PR CI          | Preview version and PR check              |
| Additional push to the same branch | PR CI          | Updated Preview version                   |
| Merge or push to `main`             | Full CI        | Production deployment                     |
| Push without an open PR             | No CI          | Preview version for non-production branch |

A successful Preview appears on the pull request as the
`Workers Builds: mazely-v-conf` check. Cloudflare builds are triggered by a push,
so connecting the repository or enabling non-production builds may require a new
push before an existing pull request receives its first Preview.

## Static assets

The checked-in `wrangler.jsonc` deploys `dist` as Worker static assets and uses
SPA fallback behavior. Configure `v-conf.mazely.dev` as a custom domain in the
Cloudflare dashboard. Workers Builds manages its deployment token; GitHub
Actions does not require a Cloudflare API token.

If no Cloudflare check appears, verify:

1. The GitHub App can access this repository.
2. The Worker is connected to the correct Git repository and `main` branch.
3. **Builds for non-production branches** is enabled.
4. Build watch paths do not exclude the changed files.

[workers-builds]: https://developers.cloudflare.com/workers/ci-cd/builds/
