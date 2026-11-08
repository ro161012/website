/**
 * Liquid glass by SVG displacement.
 *
 * Technique from kube.io's "Liquid Glass in the Browser: Refraction with CSS
 * and SVG" and mkj0kjay/vue-web-liquid-glass: a rounded-rect bezel is treated
 * as a convex lens, the resulting displacement field is rasterised into the
 * red/green channels of a PNG, and the PNG drives an <feDisplacementMap> that
 * the element uses as its backdrop-filter.
 *
 * Why this exists alongside vendor/liquidglass: that library rasterises the
 * scene into a texture and only re-shoots it when something marks it dirty, so
 * the 3D hero and the drifting blobs are frozen inside the panels. A backdrop
 * filter is evaluated by the compositor against the live backdrop every frame,
 * so what is behind the glass keeps bending as it moves.
 *
 * `backdrop-filter: url(#f)` is Chromium-only (not in the CSS spec), so init
 * throws when it is unsupported and main.js falls back to the WebGL path.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const BEZEL = 20; // depth of the refractive bevel, CSS px
const STRENGTH = 18; // peak displacement, CSS px (feDisplacementMap scale)
const BLUR = 7; // backing frost, CSS px
const SATURATE = 1.15;

/** Signed distance to a rounded rect centred on the origin; negative inside. */
function sdRoundedRect(x, y, halfW, halfH, radius) {
	const qx = Math.abs(x) - halfW + radius;
	const qy = Math.abs(y) - halfH + radius;
	return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

/**
 * Displacement map for one panel size.
 *
 * Red = x offset, green = y offset, 128 = no offset. The vector points outward
 * along the SDF gradient and falls off as (1 - t)^2 through the bezel, which is
 * the convex profile: content at the rim is sampled from outside the panel, so
 * the edge compresses the way a lens edge does.
 */
function buildMap(width, height, radius) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('no 2d context for the displacement map');

	const image = ctx.createImageData(width, height);
	const halfW = width / 2;
	const halfH = height / 2;
	const bezel = Math.max(4, Math.min(BEZEL, Math.min(halfW, halfH) * 0.85));

	let moved = 0;
	let neutral = 0;
	let peak = 0;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const px = x + 0.5 - halfW;
			const py = y + 0.5 - halfH;
			const i = (y * width + x) * 4;
			const d = sdRoundedRect(px, py, halfW, halfH, radius);

			if (d > 0) {
				image.data[i] = 128;
				image.data[i + 1] = 128;
				image.data[i + 2] = 128;
				image.data[i + 3] = 255;
				neutral++;
				continue;
			}

			const t = Math.min(1, -d / bezel);
			const magnitude = (1 - t) * (1 - t);

			if (magnitude < 0.002) {
				image.data[i] = 128;
				image.data[i + 1] = 128;
				image.data[i + 2] = 128;
				image.data[i + 3] = 255;
				neutral++;
				continue;
			}

			// outward normal, from a central difference of the SDF
			const gx =
				sdRoundedRect(px + 0.5, py, halfW, halfH, radius) -
				sdRoundedRect(px - 0.5, py, halfW, halfH, radius);
			const gy =
				sdRoundedRect(px, py + 0.5, halfW, halfH, radius) -
				sdRoundedRect(px, py - 0.5, halfW, halfH, radius);
			const len = Math.hypot(gx, gy) || 1;
			const dx = (gx / len) * magnitude;
			const dy = (gy / len) * magnitude;

			image.data[i] = Math.round(128 + dx * 127);
			image.data[i + 1] = Math.round(128 + dy * 127);
			image.data[i + 2] = 128;
			image.data[i + 3] = 255;

			moved++;
			peak = Math.max(peak, magnitude);
		}
	}

	ctx.putImageData(image, 0, 0);

	return {
		url: canvas.toDataURL('image/png'),
		stats: { width, height, radius, moved, neutral, peak: Number(peak.toFixed(3)) },
	};
}

function ensureDefs(root) {
	let svg = root.querySelector('svg.lg-defs');
	if (svg) return svg;

	svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('class', 'lg-defs');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('focusable', 'false');
	svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
	root.appendChild(svg);
	return svg;
}

/**
 * Filters are cached per geometry, so the four dock pills share one map.
 * Returns the filter id plus the map statistics for verification.
 */
function ensureFilter(defs, key, width, height, radius) {
	const id = `lg-${key}`;
	const existing = defs.querySelector(`#${id}`);
	if (existing) {
		existing.__mapStats = existing.__mapStats || null;
		return { id, stats: existing.__mapStats };
	}

	const { url, stats } = buildMap(width, height, radius);

	const filter = document.createElementNS(SVG_NS, 'filter');
	filter.setAttribute('id', id);
	filter.setAttribute('x', '0');
	filter.setAttribute('y', '0');
	filter.setAttribute('width', '100%');
	filter.setAttribute('height', '100%');
	filter.setAttribute('filterUnits', 'objectBoundingBox');
	filter.setAttribute('color-interpolation-filters', 'sRGB');

	const map = document.createElementNS(SVG_NS, 'feImage');
	map.setAttribute('href', url);
	map.setAttribute('x', '0');
	map.setAttribute('y', '0');
	map.setAttribute('width', String(width));
	map.setAttribute('height', String(height));
	map.setAttribute('preserveAspectRatio', 'none');
	map.setAttribute('result', 'map');

	const displace = document.createElementNS(SVG_NS, 'feDisplacementMap');
	displace.setAttribute('in', 'SourceGraphic');
	displace.setAttribute('in2', 'map');
	displace.setAttribute('scale', String(STRENGTH));
	displace.setAttribute('xChannelSelector', 'R');
	displace.setAttribute('yChannelSelector', 'G');

	filter.append(map, displace);
	filter.__mapStats = stats;
	defs.appendChild(filter);

	return { id, stats };
}

function radiusOf(el) {
	const style = getComputedStyle(el);
	const value = parseFloat(style.borderTopLeftRadius || '0');
	return Number.isFinite(value) ? value : 0;
}

export function initSvgGlass({ root, elements, blur = BLUR }) {
	if (typeof CSS === 'undefined' || !CSS.supports || !CSS.supports('backdrop-filter', 'url(#lg-probe)')) {
		throw new Error('backdrop-filter: url() is not supported here');
	}

	const defs = ensureDefs(root);
	const filters = new Map(); // element -> filter id
	const maps = []; // map statistics, for verification

	const apply = (el) => {
		const width = Math.round(el.offsetWidth);
		const height = Math.round(el.offsetHeight);
		if (width < 8 || height < 8) return; // hidden panel, try again later

		const radius = radiusOf(el);
		const key = `${width}x${height}x${Math.round(radius)}`;
		const { id, stats } = ensureFilter(defs, key, width, height, radius);
		if (stats && !maps.includes(stats)) maps.push(stats);

		filters.set(el, id);
		const value = `url(#${id}) blur(${blur}px) saturate(${SATURATE})`;
		el.style.setProperty('backdrop-filter', value);
		el.style.setProperty('-webkit-backdrop-filter', value);
	};

	const refresh = () => {
		for (const el of elements) apply(el);
	};

	refresh();

	// Panels change size with the viewport and the dock geometry, and the
	// displacement map is built for one exact size.
	let timer = 0;
	const observer = new ResizeObserver(() => {
		window.clearTimeout(timer);
		timer = window.setTimeout(refresh, 140);
	});
	for (const el of elements) observer.observe(el);

	return {
		mode: 'svg',
		filters,
		maps,
		// The backdrop is live, so nothing needs repainting after a text swap.
		markChanged() {},
		refresh,
		destroy() {
			observer.disconnect();
			window.clearTimeout(timer);
			for (const el of elements) {
				el.style.removeProperty('backdrop-filter');
				el.style.removeProperty('-webkit-backdrop-filter');
			}
			defs.remove();
		},
	};
}
