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
		alpha: 0.06 + depth * 0.36,
		ember: Math.random() < 0.14,
		phase: Math.random() * Math.PI * 2,
		sway: 0.1 + Math.random() * 0.5,
		spin: 0.2 + Math.random() * 0.8,
	}
}

function seed() {
	const count = Math.max(40, Math.min(150, Math.round((width * height) / 13000)))
	motes = Array.from({ length: count }, () => randomMote(true))
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
		ctx.fillStyle = mote.ember
			? `rgba(178, 44, 32, ${mote.alpha})`
			: `rgba(233, 228, 216, ${mote.alpha * 0.7})`
		ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2)
		ctx.fill()

		if (mote.r > 1.5) {
			ctx.beginPath()
			ctx.fillStyle = mote.ember
				? `rgba(178, 44, 32, ${mote.alpha * 0.16})`
				: `rgba(233, 228, 216, ${mote.alpha * 0.1})`
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
