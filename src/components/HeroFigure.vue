<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { initHero3D } from '../lib/hero3d.js'

const base = import.meta.env.BASE_URL
const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
let hero: any = null

onBeforeUnmount(() => {
	hero?.viewer?.dispose?.()
})

async function start(el: HTMLCanvasElement) {
	try {
		hero = await initHero3D(el, {
			skinUrl: `${base}assets/skin-texture.png`,
			capeUrl: `${base}assets/cape.png`,
		})
		ready.value = true
		// the canvas was hidden while the viewer booted; take its real box now
		await nextTick()
		hero.resize()
		window.rxbowHero = hero
	} catch (error) {
		console.error('[rxbow] 3d viewer failed, keeping the static render:', error)
	}
}

// template ref callback: runs as soon as the canvas exists
const bind = (el: unknown) => {
	if (el instanceof HTMLCanvasElement) start(el)
}
</script>

<template>
	<div class="hero__figure">
		<canvas
			:ref="bind"
			v-show="ready"
			class="hero__skin"
			role="img"
			tabindex="0"
			aria-label="rxbow in 3D, holding a loaded crossbow. Drag to turn the model."
		/>
		<img
			v-if="!ready"
			class="hero__skin hero__skin--img"
			:src="`${base}assets/skin-body.png`"
			alt="Minecraft skin of rxbow aiming a loaded crossbow, on a white background"
			width="481"
			height="546"
			decoding="async"
		/>
		<p v-if="ready" class="hero__hint" aria-hidden="true">drag to turn</p>
	</div>
</template>
