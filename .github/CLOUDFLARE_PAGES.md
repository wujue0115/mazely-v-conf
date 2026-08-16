# Cloudflare Pages Configuration

This project follows the Mazely Studio deployment model: GitHub Actions validates
changes, while a Cloudflare project connected to this repository performs preview
and production deployments.

## Project settings

| Setting                          | Value                                         |
| -------------------------------- | --------------------------------------------- |
| Project name                     | `mazely-v-conf`                               |
| Production branch                | `main`                                        |
| Automatic production deployments | Enabled                                       |
| Root directory                   | Repository root (blank or `/`)                |
| Build system                     | V2 or later                                   |
| Build command                    | `pnpm install --frozen-lockfile && pnpm build` |
| Build output directory           | `dist`                                        |
| Custom domain                    | `v-conf.mazely.dev`                           |
| `NODE_VERSION`                   | `24`                                          |
| `PNPM_VERSION`                   | `10.28.0`                                     |
| `SKIP_DEPENDENCY_INSTALL`        | `1`                                           |

`SKIP_DEPENDENCY_INSTALL=1` avoids Cloudflare's implicit install. The build command
performs a single reproducible frozen install instead.

## Deployment behavior

| Event                  | GitHub Actions | Cloudflare                      |
| ---------------------- | -------------- | ------------------------------- |
| Pull request to `main` | Full CI        | Preview deployment              |
| Merge to `main`        | Full CI        | Production deployment           |
| Other branch push      | No CI          | Configure as desired for preview |

The checked-in `wrangler.jsonc` mirrors Studio's static-assets configuration and
provides SPA fallback behavior. Configure the custom domain in the Cloudflare
dashboard; no Cloudflare API token is required by GitHub Actions.
