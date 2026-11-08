/**
 * iOS-style dock magnification, as in the reference project's bottom nav bar.
 *
 * Every `.pill` under `dock` grows and lifts by how close the pointer is to its
 * centre, so neighbours magnify too, and the values are sprung rather than
 * snapped. Centres come from layout boxes (width divided by the current scale)
 * so the effect cannot feed back into itself and oscillate.
 */

export interface DockMagnifyHandle {
	destroy: () => void
}

export interface DockMagnifyOptions {
	/** fraction of the pill width the pointer can be from the centre and still lift it */
	range?: number
	/** extra scale at dead centre, e.g. 0.42 → 1.42× */
	maxScale?: number
	/** upward travel in px at dead centre */
	lift?: number
}

export function initDockMagnify(dock: HTMLElement, options: DockMagnifyOptions = {}): DockMagnifyHandle {
	const range = options.range ?? 0.95
	const maxScale = options.maxScale ?? 0.42
	const maxLift = options.lift ?? 11

	const pills = Array.from(dock.querySelectorAll<HTMLElement>('.pill'))
	if (!pills.length) return { destroy() {} }

	const reduced =
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
	// touch screens have no hover, and the dock is a 2×2 grid there anyway
	const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true

	const current = pills.map(() => ({ scale: 1, lift: 0 }))
	const target = pills.map(() => ({ scale: 1, lift: 0 }))

	let frame = 0
	let lastTime = 0

	function paint(instant = false) {
		pills.forEach((pill, i) => {
			const now = current[i]
			const goal = target[i]
			if (instant) {
				now.scale = goal.scale
				now.lift = goal.lift
			}
			pill.style.setProperty('--s', now.scale.toFixed(4))
			pill.style.setProperty('--lift', `${now.lift.toFixed(2)}px`)
		})
	}

	function settled() {
		return current.every((value, i) => {
			const goal = target[i]
			return Math.abs(goal.scale - value.scale) < 0.0015 && Math.abs(goal.lift - value.lift) < 0.04
		})
	}

	// springLerp from the reference MagnifyingGlass: stiffness 340, damping 20
	function tick(time: number) {
		const dt = Math.min((time - lastTime) / 1000, 0.05)
		lastTime = time
		const k = 1 - Math.exp((-340 * dt) / 20)

		pills.forEach((pill, i) => {
			current[i].scale += (target[i].scale - current[i].scale) * k
			current[i].lift += (target[i].lift - current[i].lift) * k
			pill.style.setProperty('--s', current[i].scale.toFixed(4))
			pill.style.setProperty('--lift', `${current[i].lift.toFixed(2)}px`)
		})

		if (settled()) {
			current.forEach((value, i) => {
				value.scale = target[i].scale
				value.lift = target[i].lift
			})
			paint(true)
			frame = 0
			return
		}
		frame = requestAnimationFrame(tick)
	}

	function run() {
		if (reduced) {
			paint(true)
			return
		}
		if (frame) return
		lastTime = performance.now()
		frame = requestAnimationFrame(tick)
	}

	function influence(pill: HTMLElement, i: number) {
		// width of the settled layout box: current scale must be divided out
		const box = pill.getBoundingClientRect()
		const scale = current[i].scale || 1
		return { width: box.width / scale, center: box.left + box.width / 2, height: box.height / scale }
	}

	function setFromCursor(clientX: number) {
		pills.forEach((pill, i) => {
			const { width, height, center } = influence(pill, i)
			const distance = Math.abs(clientX - center)
			const reach = width * 0.5 + width * range * 0.5 + height * 0.25
			const t = reach > 0 ? Math.min(1, distance / reach) : 1
			const falloff = Math.cos((t * Math.PI) / 2)
			target[i].scale = 1 + maxScale * falloff
			target[i].lift = maxLift * falloff
		})
		run()
	}

	function reset() {
		target.forEach((value) => {
			value.scale = 1
			value.lift = 0
		})
		run()
	}

	function onPointerMove(event: PointerEvent) {
		if (!canHover) return
		setFromCursor(event.clientX)
	}

	function onFocusIn(event: FocusEvent) {
		const pill = (event.target as HTMLElement | null)?.closest<HTMLElement>('.pill')
		if (!pill) return
		const i = pills.indexOf(pill)
		if (i < 0) return
		pills.forEach((_, j) => {
			target[j].scale = j === i ? 1 + maxScale * 0.8 : 1
			target[j].lift = j === i ? maxLift * 0.8 : 0
		})
		run()
	}

	dock.addEventListener('pointermove', onPointerMove)
	dock.addEventListener('pointerleave', reset)
	dock.addEventListener('focusin', onFocusIn)
	dock.addEventListener('focusout', reset)
	paint(true)

	return {
		destroy() {
			dock.removeEventListener('pointermove', onPointerMove)
			dock.removeEventListener('pointerleave', reset)
			dock.removeEventListener('focusin', onFocusIn)
			dock.removeEventListener('focusout', reset)
			if (frame) cancelAnimationFrame(frame)
			frame = 0
			pills.forEach((pill) => {
				pill.style.removeProperty('--s')
				pill.style.removeProperty('--lift')
			})
		},
	}
}
