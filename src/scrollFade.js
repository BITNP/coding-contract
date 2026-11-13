export const vScrollFade = {
  mounted(el, { arg = 'y', value = 24 }) {
    const horizontal = arg === 'x'
    const update = () => {
      const position = horizontal ? el.scrollLeft : el.scrollTop
      const view = horizontal ? el.clientWidth : el.clientHeight
      const total = horizontal ? el.scrollWidth : el.scrollHeight
      el.style.setProperty('--fade-start', position > 1 ? `${value}px` : '0px')
      el.style.setProperty('--fade-end', position + view < total - 1 ? `${value}px` : '0px')
    }
    const resize = new ResizeObserver(update)
    const mutation = new MutationObserver(update)
    resize.observe(el)
    mutation.observe(el, { childList: true, subtree: true })
    el.addEventListener('scroll', update, { passive: true })
    el.classList.add('scroll-fade', `scroll-fade-${arg}`)
    el._scrollFade = () => {
      resize.disconnect()
      mutation.disconnect()
      el.removeEventListener('scroll', update)
    }
    update()
  },
  unmounted(el) {
    el._scrollFade?.()
  },
}
