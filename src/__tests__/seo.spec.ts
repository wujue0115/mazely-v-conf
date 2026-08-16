import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')

describe('SEO metadata', () => {
  it('publishes canonical, social, and structured metadata', async () => {
    const html = await readFile(resolve(projectRoot, 'index.html'), 'utf8')
    const document = new JSDOM(html).window.document
    const structuredData = JSON.parse(
      document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]')?.textContent ?? '',
    )

    expect(document.documentElement.lang).toBe('en-US')
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://v-conf.mazely.dev/',
    )
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe(
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    )
    expect(document.querySelector<HTMLMetaElement>('meta[name="twitter:card"]')?.content).toBe(
      'summary_large_image',
    )
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content).toBe(
      'https://v-conf.mazely.dev/og-image.png',
    )
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:image:width"]')?.content).toBe(
      '1200',
    )
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:image:height"]')?.content).toBe(
      '630',
    )
    expect(document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]')?.content).toBe(
      'https://v-conf.mazely.dev/og-image.png',
    )
    expect(structuredData).toMatchObject({
      '@type': 'WebApplication',
      'image': 'https://v-conf.mazely.dev/og-image.png',
      'name': 'V-CONF × Mazely',
      'url': 'https://v-conf.mazely.dev/',
    })
  })

  it('publishes crawler discovery files for the production origin', async () => {
    const [robots, sitemap, manifest, ogImage] = await Promise.all([
      readFile(resolve(projectRoot, 'public/robots.txt'), 'utf8'),
      readFile(resolve(projectRoot, 'public/sitemap.xml'), 'utf8'),
      readFile(resolve(projectRoot, 'public/site.webmanifest'), 'utf8'),
      readFile(resolve(projectRoot, 'public/og-image.png')),
    ])

    expect(robots).toContain('Sitemap: https://v-conf.mazely.dev/sitemap.xml')
    expect(sitemap).toContain('<loc>https://v-conf.mazely.dev/</loc>')
    expect(JSON.parse(manifest)).toMatchObject({ name: 'V-CONF × Mazely' })
    expect(ogImage.byteLength).toBeGreaterThan(0)
  })
})
