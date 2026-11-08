<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import GlassPanel from './components/GlassPanel.vue'
import HeroFigure from './components/HeroFigure.vue'
import LinkPill from './components/LinkPill.vue'

const base = import.meta.env.BASE_URL
const DISCORD_USERNAME = 'ro161012'

const dock = ref<HTMLElement | null>(null)

const toast = ref('')
const toastVisible = ref(false)
let timer = 0

function showToast(message: string) {
	toast.value = message
	toastVisible.value = true
	window.clearTimeout(timer)
	timer = window.setTimeout(() => (toastVisible.value = false), 2200)
}

onBeforeUnmount(() => {
	window.clearTimeout(timer)
})

async function copyDiscord() {
	let copied = false
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(DISCORD_USERNAME)
			copied = true
		} catch {
			copied = false
		}
	}
	showToast(copied ? `Discord username copied · ${DISCORD_USERNAME}` : `Discord: ${DISCORD_USERNAME}`)
}
</script>

<template>
	<main class="page">
		<!-- Painted backdrop: the glass refracts it, so it carries colour and
		     structure rather than flat white. -->
		<div class="scene" aria-hidden="true">
			<div class="scene__wash"></div>
			<div class="scene__grid"></div>
			<div class="scene__glow scene__glow--teal"></div>
			<div class="scene__glow scene__glow--warm"></div>
		</div>

		<header class="topbar">
			<GlassPanel class="chip" :radius="22" :bezel="10" :thickness="60">
				<span class="brand">
					<img
						class="brand__face"
						:src="`${base}assets/skin-face.png`"
						alt=""
						width="22"
						height="22"
					/>
					<span class="brand__name">rxbow</span>
				</span>
			</GlassPanel>
		</header>

		<section class="hero">
			<div class="hero__copy">
				<p class="eyebrow">Portfolio</p>
				<h1 class="wordmark">rxbow</h1>
				<p class="lede">
					Also known as <strong>{{ DISCORD_USERNAME }}</strong>.
				</p>

				<p class="dock-label">Elsewhere</p>

				<nav ref="dock" class="dock" aria-label="Links">
					<LinkPill label="TikTok" sub="@rxbowed" href="https://www.tiktok.com/@rxbowed">
						<template #icon>
							<svg viewBox="0 0 24 24" role="presentation">
								<path
									fill="currentColor"
									d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.6-1.62-.94-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
								/>
							</svg>
						</template>
					</LinkPill>

					<LinkPill label="Discord" sub="ro161012" @press="copyDiscord">
						<template #icon>
							<svg viewBox="0 0 24 24" role="presentation">
								<path
									fill="currentColor"
									d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.011c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.128c-.598.348-1.22.645-1.873.891a.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.029zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.419 0 1.333-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419z"
								/>
							</svg>
						</template>
					</LinkPill>

					<LinkPill
						label="Steam"
						sub="view profile"
						href="https://steamcommunity.com/profiles/76561199251152385/"
					>
						<template #icon>
							<svg viewBox="0 0 24 24" role="presentation">
								<path
									fill="currentColor"
									d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"
								/>
							</svg>
						</template>
					</LinkPill>

					<LinkPill label="Email" sub="rohansijaria@gmail.com" href="mailto:rohansijaria@gmail.com">
						<template #icon>
							<svg
								viewBox="0 0 24 24"
								role="presentation"
								fill="none"
								stroke="currentColor"
								stroke-width="1.6"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect x="2.5" y="4.75" width="19" height="14.5" rx="2.75" />
								<path d="m3.5 7.25 7.4 5.05a2 2 0 0 0 2.2 0l7.4-5.05" />
							</svg>
						</template>
					</LinkPill>
				</nav>
			</div>

			<div class="hero__stage">
				<HeroFigure />
			</div>
		</section>

		<footer class="foot">
			<span>&copy; rxbow</span>
			<span class="foot__credit">Liquid glass after kube.io &amp; mkj0kjay</span>
		</footer>

		<GlassPanel
			class="toast"
			:class="{ 'is-visible': toastVisible }"
			:radius="16"
			:bezel="12"
			:thickness="60"
		>
			<span class="toast__text">{{ toast }}</span>
		</GlassPanel>
	</main>
</template>
