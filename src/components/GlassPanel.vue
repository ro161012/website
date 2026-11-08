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
		/** lens magnification of the backdrop, sprung up while the panel is hovered */
		magnify?: boolean
		magnifyAmount?: number
	}>(),
	{
		radius: 26,
		bezel: 16,
		thickness: 90,
		refractiveIndex: 1.5,
		blur: 0.5,
		specularOpacity: 0.5,
		specularSaturation: 1.6,
		magnify: false,
		magnifyAmount: 20,
	},
)

const uid = `lg-${Math.random().toString(36).slice(2, 8)}`
const el = ref<HTMLElement | null>(null)
const size = ref({ w: 240, h: 72 })
let observer: ResizeObserver | null = null
let frame = 0

// The magnify map is generated once; only this attribute animates, so the glass
// never rebuilds its PNGs while the pointer is inside the panel.
const magnifyScale = ref(0)
let magnifyTarget = 0
let magnifyFrame = 0
let magnifyTime = 0

function animateMagnify(time: number) {
	const dt = Math.min((time - magnifyTime) / 1000, 0.05)
	magnifyTime = time
	// same spring as the reference MagnifyingGlass: stiffness 250, damping 14
	const k = 1 - Math.exp((-250 * dt) / 14)
	const next = magnifyScale.value + (magnifyTarget - magnifyScale.value) * k
	if (Math.abs(magnifyTarget - next) < 0.05) {
		magnifyScale.value = magnifyTarget
		magnifyFrame = 0
		return
	}
	magnifyScale.value = next
	magnifyFrame = requestAnimationFrame(animateMagnify)
}

const reducedMotion =
	typeof window !== 'undefined' && window.matchMedia
		? window.matchMedia('(prefers-reduced-motion: reduce)').matches
		: false

function springMagnify(to: number) {
	if (!props.magnify) return
	magnifyTarget = to
	if (reducedMotion) {
		magnifyScale.value = to
		return
	}
	if (magnifyFrame) return
	magnifyTime = performance.now()
	magnifyFrame = requestAnimationFrame(animateMagnify)
}

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
	springMagnify(0)
}

function onPointerEnter() {
	springMagnify(props.magnifyAmount)
}

function onBlur() {
	springMagnify(0)
}

onMounted(() => {
	measure()
	if (!el.value) return
	observer = new ResizeObserver(measure)
	observer.observe(el.value)
	el.value.style.setProperty('--mx', '50%')
	el.value.style.setProperty('--my', '0%')
	el.value.addEventListener('pointermove', onPointerMove)
	el.value.addEventListener('pointerenter', onPointerEnter)
	el.value.addEventListener('pointerleave', onPointerLeave)
	el.value.addEventListener('focusin', onPointerEnter)
	el.value.addEventListener('focusout', onBlur)
})

onBeforeUnmount(() => {
	observer?.disconnect()
	if (frame) cancelAnimationFrame(frame)
	if (magnifyFrame) cancelAnimationFrame(magnifyFrame)
	el.value?.removeEventListener('pointermove', onPointerMove)
	el.value?.removeEventListener('pointerenter', onPointerEnter)
	el.value?.removeEventListener('pointerleave', onPointerLeave)
	el.value?.removeEventListener('focusin', onPointerEnter)
	el.value?.removeEventListener('focusout', onBlur)
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
			:magnify="magnify"
			:magnifying-scale="magnifyScale"
			:quality="2"
		/>
		<div class="glass-panel__body">
			<slot />
		</div>
	</div>
</template>
