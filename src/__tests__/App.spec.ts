import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('renders Studio-style maze controls with generation progress', async () => {
    const wrapper = mount(App)

    expect(wrapper.text()).not.toContain('Watch Vue')
    expect(wrapper.text()).not.toContain('Maze generation, visualized')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('.playback-cluster .bar-btn').attributes('aria-label')).toBe('Open visualization settings')
    await wrapper.get('button[aria-label="Open visualization settings"]').trigger('click')
    expect(wrapper.text()).toContain('Recursive Backtracker')
    expect(wrapper.text()).toContain('Randomized Prim')
    expect(wrapper.text()).toContain('Randomized Kruskal')
    expect(wrapper.text()).toContain('Automatic rotation')
    expect(wrapper.get('input#automatic-rotation').attributes('type')).toBe('checkbox')
    expect(wrapper.text()).toContain('Route selection')
    expect((wrapper.get('input#route-selection').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.findAll('select#pieces-per-cell option')).toHaveLength(5)
    expect(wrapper.get('input#block-height').attributes('max')).toBe('0.8')
    expect((wrapper.get('input#block-height').element as HTMLInputElement).value).toBe('0.3')
    expect(wrapper.find('input#block-size').exists()).toBe(true)
    const speedGroup = wrapper.get('[role="group"][aria-label="Animation speed"]')
    expect(speedGroup.findAll('button').map(button => button.text())).toEqual([
      'slow',
      'normal',
      'fast',
    ])
    expect(speedGroup.findAll('button')[0]?.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[role="group"][aria-label="Maze size"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Generate')
    expect(wrapper.text()).not.toContain('Running')
    expect(wrapper.find('button[aria-label="Focus maze"]').exists()).toBe(true)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    await wrapper.get('button[aria-label="Close visualization settings"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('[role="progressbar"][aria-label="Maze generation progress"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Collapse playback panel"]').exists()).toBe(false)
    expect(wrapper.find('a[href="https://v-conf.vue.tw/"]').exists()).toBe(true)
    expect(wrapper.find('a[href="https://mazely.dev"]').exists()).toBe(true)
    expect(wrapper.find('.brand-pair').exists()).toBe(false)
    expect(wrapper.findAll('.site-links a').map(link => link.text())).toEqual([
      'V-Conf',
      'Mazely',
      'GitHub',
    ])
    expect(wrapper.find('.footnote').text()).toContain('© 2026 Wujue')
    expect(wrapper.find('.footnote').text()).toContain('v0.1.0')

    const maskButtons = wrapper.findAll('.mask-switcher button')
    expect(maskButtons.map(button => button.text())).toEqual(['Vue', 'Vite'])
    expect(maskButtons[0]?.attributes('aria-pressed')).toBe('true')
    await maskButtons[1]?.trigger('click')
    expect(maskButtons[1]?.attributes('aria-pressed')).toBe('true')
    const hero = wrapper.get('.hero').element as HTMLElement
    expect(hero.style.getPropertyValue('--theme-primary')).toBe('#8b5cf6')
  })
})
