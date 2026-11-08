<script setup lang="ts">
/**
 * A glass surface.
 *
 * The refraction itself comes from Filter.vue (ported from
 * mkj0kjay/vue-web-liquid-glass): it rasterises a bezel displacement map and a
 * specular map, then wires them into an SVG filter. This component measures the
 * panel, keeps that filter sized to it, and points `backdrop-filter` at it —
 * which makes the compositor refract the live backdrop instead of a snapshot.
 *
 * Outside Chromium `backdrop-filter: url()` does nothing, so the panel falls
 * back to a plain blur and keeps its border and shadow.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Filter from './Filter.vue'

const props = withDefaults(
	defineProps<{
		radius?: number
		bezel?: number
		thickness?: number
		refractiveIndex?: number
		blur?: number
		specularOpacity?: number
		specularSaturation?: number
	}>(),
	{
		radius: 26,
		bezel: 16,
		thickness: 90,
		refractiveIndex: 1.5,
		blur: 0.5,
		specularOpacity: 0.5,
		specularSaturation: 1.6,
	},
)

const uid = `lg-${Math.random().toString(36).slice(2, 8)}`
const el = ref<HTMLElement | null>(null)
const size = ref({ w: 240, h: 72 })
let observer: ResizeObserver | null = null
let frame = 0

const supported =
	typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('backdrop-filter', 'url(#lg-probe)')

// Filter.vue takes cornerRadius as a fraction of the maximum possible radius.
const cornerFraction = computed(() => {
	const max = Math.min(size.value.w, size.value.h) / 2
	return max > 0 ? Math.min(1, props.radius / max) : 1
})

const style = computed(() => ({
	borderRadius: `${props.radius}px`,
	backdropFilter: supported
		? `url(#${uid}) saturate(1.12)`
		: 'blur(16px) saturate(1.35)',
	WebkitBackdropFilter: supported ? `url(#${uid})` : 'blur(16px) saturate(1.35)',
}))

function measure() {
	if (!el.value) return
	const box = el.value.getBoundingClientRect()
	if (box.width > 8 && box.height > 8) {
		size.value = { w: Math.round(box.width), h: Math.round(box.height) }
	}
}

// Specular highlight that follows the cursor. The filter's specular map is
// baked for one light angle, so movement is painted by a pseudo-element
// positioned with these two properties.
function onPointerMove(event: PointerEvent) {
	if (!el.value) return
	const box = el.value.getBoundingClientRect()
	if (!box.width || !box.height) return
	const x = ((event.clientX - box.left) / box.width) * 100
	const y = ((event.clientY - box.top) / box.height) * 100
	if (frame) return
	frame = requestAnimationFrame(() => {
		frame = 0
		el.value?.style.setProperty('--mx', `${x}%`)
		el.value?.style.setProperty('--my', `${y}%`)
	})
}

function onPointerLeave() {
	if (!el.value) return
	el.value.style.setProperty('--mx', '50%')
	el.value.style.setProperty('--my', '0%')
}

onMounted(() => {
	measure()
	if (!el.value) return
	observer = new ResizeObserver(measure)
	observer.observe(el.value)
	el.value.style.setProperty('--mx', '50%')
	el.value.style.setProperty('--my', '0%')
	el.value.addEventListener('pointermove', onPointerMove)
	el.value.addEventListener('pointerleave', onPointerLeave)
})

onBeforeUnmount(() => {
	observer?.disconnect()
	if (frame) cancelAnimationFrame(frame)
	el.value?.removeEventListener('pointermove', onPointerMove)
	el.value?.removeEventListener('pointerleave', onPointerLeave)
})
</script>

<template>
	<div ref="el" class="glass-panel" :style="style">
		<Filter
			:id="uid"
			:width="size.w"
			:height="size.h"
			:radius="radius"
			:bezel-width="bezel"
			:glass-thickness="thickness"
			:refractive-index="refractiveIndex"
			:blur="blur"
			:specular-opacity="specularOpacity"
			:specular-saturation="specularSaturation"
			shape="rectangle"
			:corner-radius="cornerFraction"
			:quality="2"
		/>
		<div class="glass-panel__body">
			<slot />
		</div>
	</div>
</template>
