/**
 * rxbow — liquid glass portfolio
 *
 * The glass effect comes from @ybouane/liquidglass, which rasterises the root's
 * children and runs them through a WebGL refraction shader. It only knows how
 * to sample content that already exists, so the boot sequence waits for fonts
 * and images before initialising.
 */

// Vendored @ybouane/liquidglass@1.0.3 with a one-line fix in createImage() —
// see vendor/liquidglass/NOTICE.md. Imported locally so the glass never
// depends on a CDN being reachable at runtime.
const LIQUIDGLASS_URL = './vendor/liquidglass/liquidglass.js';
const DISCORD_USERNAME = 'ro161012';

const stage = document.getElementById('stage');
const toast = document.getElementById('toast');
const discordBtn = document.getElementById('discord');

/** Glass elements must be direct children of the root. */
const glassElements = Array.from(stage.children).filter((el) => el.classList.contains('glass'));

let glass = null;
let toastTimer = 0;

function showToast(message) {
	if (!toast) return;
	toast.textContent = message;
	toast.classList.add('is-visible');
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

async function copyText(text) {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			/* fall through to the legacy path */
		}
	}

	const field = document.createElement('textarea');
	field.value = text;
	field.setAttribute('readonly', '');
	field.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
	document.body.appendChild(field);
	field.select();
	let ok = false;
	try {
		ok = document.execCommand('copy');
	} catch {
		ok = false;
	}
	field.remove();
	return ok;
}

function waitForWindowLoad() {
	if (document.readyState === 'complete') return Promise.resolve();
	return new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
}

async function decodeImages() {
	await Promise.all(
		Array.from(document.images).map((img) =>
			img.complete ? Promise.resolve() : img.decode().catch(() => undefined)
		)
	);
}

function hideShaderCanvases() {
	for (const el of glassElements) {
		const canvas = el.querySelector(':scope > canvas');
		if (canvas) {
			canvas.setAttribute('aria-hidden', 'true');
			canvas.setAttribute('tabindex', '-1');
		}
	}
}

const t0 = performance.now();
const mark = (label) => console.info(`[rxbow] ${label} @ ${Math.round(performance.now() - t0)}ms`);

async function start() {
	await waitForWindowLoad();
	mark('window loaded');
	await document.fonts.ready;
	mark('fonts ready');
	await decodeImages();
	mark('images decoded');

	const { LiquidGlass } = await import(LIQUIDGLASS_URL);
	mark('library imported');

	glass = await LiquidGlass.init({
		root: stage,
		glassElements,
	});
	mark('glass ready');

	hideShaderCanvases();
	stage.dataset.glass = 'on';

	// Debug handle for tuning shader values from the console.
	window.rxbowGlass = glass;
}

if (discordBtn) {
	discordBtn.addEventListener('click', async () => {
		const sub = discordBtn.querySelector('.pill__sub');
		const copied = await copyText(DISCORD_USERNAME);
		const previous = sub ? sub.textContent : '';

		if (sub) {
			sub.textContent = copied ? 'copied!' : DISCORD_USERNAME;
			window.setTimeout(() => {
				if (sub.isConnected) sub.textContent = previous;
				// The library rebuilds a panel's texture when its DOM changes,
				// but a nudge never hurts if the mutation lands mid-capture.
				glass?.markChanged(discordBtn);
			}, 1800);
		}

		// Content inside a glass panel is baked into the shader output, so the
		// label swap above needs an explicit repaint the moment it happens too.
		glass?.markChanged(discordBtn);
		showToast(copied ? `Discord username copied · ${DISCORD_USERNAME}` : `Discord: ${DISCORD_USERNAME}`);
	});
}

start().catch((error) => {
	console.error('[rxbow] glass init failed, falling back to CSS frost:', error);
	stage.classList.add('no-glass');
	stage.dataset.glass = 'off';
});
