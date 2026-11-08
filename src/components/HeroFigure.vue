<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { initHero3D } from '../lib/hero3d.js'

const base = import.meta.env.BASE_URL
const canvas = ref<HTMLCanvasElement | null>(null)
const figure = ref<HTMLElement | null>(null)
const ready = ref(false)
const failed = ref(false)
let hero: any = null
let resizeObserver: ResizeObserver | null = null
let retry = 0

/** Keep the page's plinth line exactly under the model's feet. */
function syncGround() {
	const ratio = hero?.groundRatio?.()
	if (typeof ratio === 'number' && Number.isFinite(ratio)) {
		figure.value?.style.setProperty('--ground', ratio.toFixed(4))
	}
}

async function start(el: HTMLCanvasElement) {
	try {
		hero = await initHero3D(el, {
			skinUrl: `${base}assets/skin-texture.png`,
			onGround: (ratio: number) => {
				if (Number.isFinite(ratio)) figure.value?.style.setProperty('--ground', ratio.toFixed(4))
			},
		})
		ready.value = true
		// the canvas was hidden while the viewer booted; take its real box now
		await nextTick()
		hero.resize()
		hero.fitCamera?.()
		window.rxbowHero = hero
		// the first frame has to land before the feet can be projected
		retry = requestAnimationFrame(() => {
			syncGround()
			retry = requestAnimationFrame(syncGround)
		})
		window.setTimeout(syncGround, 400)
	} catch (error) {
		console.error('[rxbow] 3d viewer failed:', error)
		failed.value = true
	}
}

// template ref callback: runs as soon as the canvas exists
const bind = (el: unknown) => {
	if (el instanceof HTMLCanvasElement) start(el)
}

onMounted(() => {
	if (!figure.value) return
	// the viewer resizes its buffer itself; this only realigns the plinth line
	resizeObserver = new ResizeObserver(syncGround)
	resizeObserver.observe(figure.value)
})

onBeforeUnmount(() => {
	resizeObserver?.disconnect()
	if (retry) cancelAnimationFrame(retry)
	hero?.viewer?.dispose?.()
})
</script>

<template>
	<div ref="figure" class="figure">
		<canvas
			:ref="bind"
			v-show="ready"
			class="figure__skin"
			role="img"
			tabindex="0"
			aria-label="rxbow's Minecraft character, standing. Drag to turn."
		/>

		<!-- Loading and failure states are drawn, not photographed, so the hero
		     never shows a pose the 3D model has stopped making. -->
		<div v-if="!ready" class="figure__placeholder" aria-hidden="true">
			<img
				class="figure__face"
				:src="`${base}assets/skin-face.png`"
				alt=""
				width="64"
				height="64"
				decoding="async"
			/>
			<span class="figure__state">{{ failed ? '3D unavailable' : 'loading' }}</span>
		</div>

		<div class="figure__ground" aria-hidden="true"></div>
		<p v-if="ready" class="figure__hint" aria-hidden="true">drag to turn</p>
	</div>
</template>
