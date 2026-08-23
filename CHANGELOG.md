# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-23

### Changed

- Moved visualization settings, route selection, and automatic rotation into
  the playback panel for faster access.
- Updated the route-selection and 3D automatic-rotation icons to make their
  modes easier to recognize.
- Kept automatic rotation active while selecting route points and playing the
  solved route.

## [0.1.0] - 2026-08-18

### Added

- Added an interactive Three.js maze visualization driven by Mazely generation
  steps.
- Added falling, layered cell blocks and edge-to-edge path connectors using
  source image colors.
- Added Vue and Vite image-mask presets with animated green and purple themes.
- Added Recursive Backtracker, Randomized Prim, and Randomized Kruskal generation
  options.
- Added randomized generation seeds and randomized valid starting cells.
- Added Studio-inspired playback controls for play, pause, regenerate, focus,
  and generation progress.
- Added a visualization settings dialog for algorithm, automatic rotation,
  blocks per cell, block height, block size, and maze size.
- Added interactive start and destination selection with an animated 3D route,
  markers, hover feedback, and route-selection settings.
- Added orbit and zoom controls, automatic rotation, responsive camera framing,
  and mobile performance limits.
- Added responsive mask selection, project navigation, reduced-motion behavior,
  and mobile layouts.
- Added unit, component, and Chromium end-to-end test coverage.
- Added GitHub Actions CI for typechecking, linting, tests, and production builds.
- Added Cloudflare static-assets deployment configuration with SPA fallback for
  `v-conf.mazely.dev`.
- Added canonical metadata, robots directives, and a sitemap for the production
  domain.
- Added Open Graph and X/Twitter preview metadata using the Mazely Docs social
  image.
- Added contributor guidance, a pull request template, and recommended `main`
  branch protection rules for a pull-request-based workflow.

### Changed

- Reorganized visualization code into the compact `src/mazely` module containing
  configuration, image-mask processing, and rendering responsibilities.
- Changed lint scripts so CI checks remain read-only while fixes are available
  through `pnpm lint:fix`.
- Updated playback state and progress feedback to support maze generation,
  point selection, route solving, and repeated destination selection.
- Replaced the generated Vue starter documentation with project-specific setup,
  architecture, testing, and deployment guidance.

[Unreleased]: https://github.com/wujue0115/mazely-v-conf/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/wujue0115/mazely-v-conf/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/wujue0115/mazely-v-conf/releases/tag/v0.1.0
