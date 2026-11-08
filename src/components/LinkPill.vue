<script setup lang="ts">
import GlassPanel from './GlassPanel.vue'

withDefaults(
	defineProps<{
		label: string
		sub: string
		href?: string
	}>(),
	{ href: '' },
)

defineEmits<{ (e: 'press'): void }>()
</script>

<template>
	<GlassPanel class="pill" :radius="26" :bezel="16" :thickness="90">
		<component
			:is="href ? 'a' : 'button'"
			class="pill__hit"
			:href="href || undefined"
			:target="href ? '_blank' : undefined"
			:rel="href ? 'me noopener noreferrer' : undefined"
			:type="href ? undefined : 'button'"
			@click="$emit('press')"
		>
			<span class="pill__icon" aria-hidden="true">
				<slot name="icon" />
			</span>
			<span class="pill__text">
				<span class="pill__label">{{ label }}</span>
				<span class="pill__sub">{{ sub }}</span>
			</span>
		</component>
	</GlassPanel>
</template>
