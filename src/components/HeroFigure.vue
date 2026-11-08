<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { initHero3D } from '../lib/hero3d.js'

const base = import.meta.env.BASE_URL
const ready = ref(false)
const failed = ref(false)
let hero: any = null

async function start(el: HTMLCanvasElement) {
	try {
		hero = await initHero3D(el, {
			skinUrl: `${base}assets/skin-texture.png`,
		})
		ready.value = true
		// the canvas was hidden while the viewer booted; take its real box now
		await nextTick()
		hero.resize()
		hero.fitCamera?.()
		window.rxbowHero = hero
	} catch (error) {
		console.error('[rxbow] 3d viewer failed:', error)
		failed.value = true
	}
}

// template ref callback: runs as soon as the canvas exists
const bind = (el: unknown) => {
	if (el instanceof HTMLCanvasElement) start(el)
}

onBeforeUnmount(() => {
	hero?.viewer?.dispose?.()
})
</script>

<template>
	<div class="figure">
		<canvas
			:ref="bind"
			v-show="ready"
			class="figure__skin"
			role="img"
			aria-label="rxbow's Minecraft character, standing."
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
	</div>
</template>
