import { ref, onMounted, onBeforeUnmount } from 'vue'

/** 观察元素尺寸，供 SVG 图面按真实像素绘制 */
export function useSize(elRef, fallback = { width: 1200, height: 700 }) {
  const width = ref(fallback.width)
  const height = ref(fallback.height)
  let ro = null
  onMounted(() => {
    const el = elRef.value
    if (!el) return
    const apply = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0) width.value = Math.round(r.width)
      if (r.height > 0) height.value = Math.round(r.height)
    }
    apply()
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(apply)
      ro.observe(el)
    }
  })
  onBeforeUnmount(() => ro && ro.disconnect())
  return { width, height }
}
