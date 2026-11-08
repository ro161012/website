import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Relative base so the build works from a GitHub Pages project path.
export default defineConfig({
	base: './',
	plugins: [vue(), tailwindcss()],
})
