import './style.css'

/* ------------------------------------------------------------------ clock */

const clock = document.getElementById('clock')
const tzLabel = document.getElementById('tz')

function timeZoneName() {
	try {
		const part = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
			.formatToParts(new Date())
			.find((p) => p.type === 'timeZoneName')
		return part?.value ?? ''
	} catch {
		return ''
	}
}

const pad = (n) => String(n).padStart(2, '0')

function tickClock() {
	const now = new Date()
	clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
	clock.dateTime = now.toISOString()
}

tzLabel.textContent = timeZoneName()
tickClock()
setInterval(tickClock, 1000)

/* -------------------------------------------------------------------- ash */

const canvas = document.getElementById('ash')
const ctx = canvas.getContext('2d', { alpha: true })
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let width = 0
let height = 0
let motes = []
let frame = 0
let elapsed = 0

function randomMote(fromBottom) {
	const depth = Math.random()
	return {
		x: Math.random() * width,
		y: fromBottom ? height + 12 : Math.random() * height,
		r: 0.4 + depth * 1.9,
		vy: -(0.1 + depth * 0.5),
		vx: (Math.random() - 0.5) * 0.16,
		alpha: 0.05 + depth * 0.3,
		phase: Math.random() * Math.PI * 2,
		sway: 0.1 + Math.random() * 0.5,
		spin: 0.2 + Math.random() * 0.8,
	}
}

function seed() {
	const count = Math.max(40, Math.min(150, Math.round((width * height) / 13000)))
	// start spread across the viewport: reduced motion never advances the loop, so
	// motes seeded below the fold would never be seen
	motes = Array.from({ length: count }, () => randomMote(false))
}

function resize() {
	const dpr = Math.min(window.devicePixelRatio || 1, 2)
	width = window.innerWidth
	height = window.innerHeight
	canvas.width = Math.round(width * dpr)
	canvas.height = Math.round(height * dpr)
	canvas.style.width = `${width}px`
	canvas.style.height = `${height}px`
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	seed()
	draw(0)
}

function draw(dt) {
	ctx.clearRect(0, 0, width, height)
	elapsed += dt

	for (const mote of motes) {
		if (dt > 0) {
			mote.y += mote.vy * dt * 60 * 0.5
			mote.x += (mote.vx + Math.sin(elapsed * mote.spin + mote.phase) * mote.sway * 0.4) * dt * 60 * 0.5
			if (mote.y < -16) {
				Object.assign(mote, randomMote(false), { y: height + 12 })
			}
			if (mote.x < -20) mote.x = width + 20
			if (mote.x > width + 20) mote.x = -20
		}

		// ash catches the light unevenly: a soft core plus a faint halo
		ctx.beginPath()
		ctx.fillStyle = `rgba(10, 10, 10, ${mote.alpha * 0.7})`
		ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2)
		ctx.fill()

		if (mote.r > 1.5) {
			ctx.beginPath()
			ctx.fillStyle = `rgba(10, 10, 10, ${mote.alpha * 0.1})`
			ctx.arc(mote.x, mote.y, mote.r * 3.6, 0, Math.PI * 2)
			ctx.fill()
		}
	}
}

let last = 0

function loop(time) {
	const dt = last ? Math.min((time - last) / 1000, 0.05) : 0
	last = time
	draw(dt)
	frame = requestAnimationFrame(loop)
}

function start() {
	if (calm || frame) {
		draw(0)
		return
	}
	last = 0
	frame = requestAnimationFrame(loop)
}

function stop() {
	if (frame) cancelAnimationFrame(frame)
	frame = 0
}

resize()
start()

window.addEventListener('resize', resize)

document.addEventListener('visibilitychange', () => {
	if (document.hidden) stop()
	else start()
})

/* ------------------------------------------------------------------ globe */

// A dot sphere: Fibonacci-distributed points drawn as tiny squares, shaded by
// depth. Ink only, so it reads as part of the paper rather than an object
// sitting on top of it. It turns slowly and tilts toward the pointer.
const globe = document.getElementById('globe')

if (globe) {
	const gctx = globe.getContext('2d', { alpha: true })
	const points = []
	const count = 2400
	const golden = Math.PI * (3 - Math.sqrt(5))

	for (let i = 0; i < count; i++) {
		const y = 1 - (i / (count - 1)) * 2
		const ring = Math.sqrt(1 - y * y)
		const theta = golden * i
		points.push([Math.cos(theta) * ring, y, Math.sin(theta) * ring])
	}

	let gw = 1
	let gh = 1
	let gdpr = 1
	let rot = 0
	let tiltX = 0
	let tiltY = 0
	let targetX = 0
	let targetY = 0
	let gframe = 0
	let glast = 0

	function sizeGlobe() {
		gdpr = Math.min(window.devicePixelRatio || 1, 2)
		gw = globe.clientWidth || 1
		gh = globe.clientHeight || 1
		globe.width = Math.round(gw * gdpr)
		globe.height = Math.round(gh * gdpr)
		gctx.setTransform(gdpr, 0, 0, gdpr, 0, 0)
	}

	function drawGlobe(dt) {
		tiltX += (targetX - tiltX) * 0.04
		tiltY += (targetY - tiltY) * 0.04
		gctx.clearRect(0, 0, gw, gh)

		const radius = gw * 0.42
		const cx = gw / 2
		const cy = gh / 2
		const yaw = rot + tiltY
		const pitch = 0.38 + tiltX
		const ca = Math.cos(yaw)
		const sa = Math.sin(yaw)
		const cb = Math.cos(pitch)
		const sb = Math.sin(pitch)

		for (const [x, y, z] of points) {
			const x1 = x * ca - z * sa
			const z1 = x * sa + z * ca
			const y2 = y * cb - z1 * sb
			const z2 = y * sb + z1 * cb
			const depth = (z2 + 1) / 2
			if (depth < 0.1) continue

			// fade the outer ring out, so the silhouette dissolves into the black page
			// instead of ending on a hard dotted rim
			const edge = Math.min(1, Math.max(0, (Math.hypot(x1, y2) - 0.66) / 0.34))
			const rim = 1 - edge * edge * (3 - 2 * edge) * 0.92

			// near-side points carry the shape; far-side points are a faint haze
			const front = z2 > 0
			const alpha = front ? (0.12 + depth * 0.46) * rim : depth * 0.07 * rim
			gctx.fillStyle = `rgba(10, 10, 10, ${alpha.toFixed(3)})`

			const size = (front ? 1.1 : 0.7) + depth * 1.1
			gctx.fillRect(cx + x1 * radius - size / 2, cy + y2 * radius - size / 2, size, size)
		}

		if (dt > 0) rot += dt * 0.13
	}

	function loopGlobe(time) {
		const dt = glast ? Math.min((time - glast) / 1000, 0.05) : 0
		glast = time
		drawGlobe(dt)
		gframe = requestAnimationFrame(loopGlobe)
	}

	function startGlobe() {
		if (calm || gframe) {
			drawGlobe(0)
			return
		}
		glast = 0
		gframe = requestAnimationFrame(loopGlobe)
	}

	function stopGlobe() {
		if (gframe) cancelAnimationFrame(gframe)
		gframe = 0
	}

	sizeGlobe()
	startGlobe()

	window.addEventListener('resize', () => {
		sizeGlobe()
		drawGlobe(0)
	})

	document.addEventListener('visibilitychange', () => {
		if (document.hidden) stopGlobe()
		else startGlobe()
	})

	window.addEventListener(
		'pointermove',
		(event) => {
			targetY = (event.clientX / window.innerWidth - 0.5) * 0.6
			targetX = (event.clientY / window.innerHeight - 0.5) * 0.5
			// with motion reduced the sphere still answers the pointer, just without spin
			if (calm) {
				tiltX = targetX
				tiltY = targetY
				drawGlobe(0)
			}
		},
		{ passive: true }
	)
}

/* --------------------------------------------------------- panel parallax */

// The panel drifts on its own; the pointer adds a slight offset so the printed
// page reads as a surface in front of the viewer rather than a flat texture.
const panelLayer = document.querySelector('.panel__layer')

if (panelLayer && !calm) {
	const reach = 16
	let targetX = 0
	let targetY = 0
	let currentX = 0
	let currentY = 0
	let raf = 0

	const settle = () => {
		currentX += (targetX - currentX) * 0.08
		currentY += (targetY - currentY) * 0.08
		panelLayer.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`
		if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
			raf = requestAnimationFrame(settle)
		} else {
			raf = 0
		}
	}

	window.addEventListener(
		'pointermove',
		(event) => {
			targetX = -((event.clientX / window.innerWidth) * 2 - 1) * reach
			targetY = -((event.clientY / window.innerHeight) * 2 - 1) * reach
			if (!raf) raf = requestAnimationFrame(settle)
		},
		{ passive: true }
	)
}

/* ------------------------------------------------------------ copy to clip */

const toast = document.getElementById('toast')
let toastTimer = 0

function showToast(message) {
	toast.textContent = message
	toast.classList.add('is-visible')
	clearTimeout(toastTimer)
	toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2000)
}

for (const button of document.querySelectorAll('[data-copy]')) {
	button.addEventListener('click', async () => {
		const value = button.dataset.copy
		let copied = false
		try {
			await navigator.clipboard.writeText(value)
			copied = true
		} catch {
			copied = false
		}
		showToast(copied ? `discord · ${value} copied` : `discord · ${value}`)
	})
}
