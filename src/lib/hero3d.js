/**
 * hero3d.js — the live hero character, standing still.
 *
 * Two pieces, both in model units (1 unit = 1/16 block, player is 32 tall):
 *   - the character: skinview3d's SkinViewer, standing still with its arms at
 *     its sides — no props, no animation, just the skin as it is in game
 *
 * three and skinview3d are vendored UMD bundles loaded on demand.
 */

const ASSET_BASE = import.meta.env?.BASE_URL ?? "./";
const THREE_SRC = `${ASSET_BASE}vendor/three/three.min.js`;
const SKINVIEW_SRC = `${ASSET_BASE}vendor/skinview3d/skinview3d.bundle.js`;

function loadScript(src) {
	const existing = document.querySelector(`script[data-rxbow-src="${src}"]`);
	if (existing) {
		if (existing.dataset.loaded === 'true') return Promise.resolve();
		return new Promise((resolve, reject) => {
			existing.addEventListener('load', () => resolve(), { once: true });
			existing.addEventListener('error', () => reject(new Error(`failed to load ${src}`)), { once: true });
		});
	}

	return new Promise((resolve, reject) => {
		const el = document.createElement('script');
		el.src = src;
		el.async = false;
		el.dataset.rxbowSrc = src;
		el.addEventListener('load', () => {
			el.dataset.loaded = 'true';
			resolve();
		});
		el.addEventListener('error', () => reject(new Error(`failed to load ${src}`)));
		document.head.appendChild(el);
	});
}

export async function initHero3D(canvas, { skinUrl }) {
	await loadScript(THREE_SRC);
	await loadScript(SKINVIEW_SRC);

	const THREE = window.THREE;
	const skinview3d = window.skinview3d;
	if (!THREE || !skinview3d) throw new Error('three / skinview3d did not register');

	// The canvas is display:none until the first frame lands, so measuring it
	// here would give 0x0 and leave the viewer stuck at its fallback size.
	// Measure the figure instead: the fallback render is what defines the box.
	const frame = canvas.parentElement?.getBoundingClientRect();
	const width = Math.round(frame?.width || canvas.clientWidth || 320);
	const height = Math.round(frame?.height || canvas.clientHeight || 520);

	const viewer = new skinview3d.SkinViewer({
		canvas,
		width,
		height,
		skin: skinUrl,
		model: 'auto-detect',
	});

	// Standing still: no animation is added, so the model keeps the in-game
	// idle pose with its arms down. The controls stay off entirely — they turn
	// the camera on bare pointer movement, so a cursor crossing the canvas would
	// swing the figure, and a finger could not scroll the page over it.
	viewer.controls.enabled = false;
	viewer.zoom = 1;
	viewer.autoRotate = false;

	const body = viewer.playerObject.skin || viewer.playerObject;

	body.updateWorldMatrix(true, true);

	/**
	 * The box the camera fits. A plain Box3 on the player includes the hidden
	 * ear group, which is 5 units taller than the figure and would frame it
	 * small with a lopsided margin, so only visible meshes count.
	 */
	function visibleBounds() {
		const box = new THREE.Box3();
		const meshBox = new THREE.Box3();
		body.traverse((object) => {
			if (!object.isMesh) return;
			let visible = true;
			for (let node = object; node && node !== body; node = node.parent) {
				if (node.visible === false) {
					visible = false;
					break;
				}
			}
			if (!visible) return;
			meshBox.setFromObject(object);
			if (meshBox.isEmpty()) return;
			box.union(meshBox);
		});
		return box.isEmpty() ? new THREE.Box3().setFromObject(body) : box;
	}

	/**
	 * Frame the whole standing body — feet to head — for whatever box the canvas
	 * currently has. skinview3d's own framing zooms to the width, which crops a
	 * tall, narrow column, so the distance is solved from both axes instead.
	 */
	function fitCamera() {
		body.updateWorldMatrix(true, true);
		const box = visibleBounds();
		const boxSize = box.getSize(new THREE.Vector3());
		const centerY = (box.min.y + box.max.y) / 2;
		const fov = (viewer.camera.fov * Math.PI) / 180;
		const aspect = viewer.camera.aspect || 1;
		const distV = ((boxSize.y * 1.14) / 2) / Math.tan(fov / 2);
		const distH = ((boxSize.x * 1.32) / 2) / Math.tan(fov / 2) / aspect;
		const dist = Math.max(distV, distH);

		viewer.camera.position.set(0, centerY + boxSize.y * 0.015, dist);
		viewer.camera.lookAt(0, centerY, 0);
		viewer.camera.updateProjectionMatrix();
	}

	fitCamera();
	// auto-detect can swap the slim/classic model once the skin decodes
	window.setTimeout(fitCamera, 350);

	/* ---- keep the drawing buffer in step with the CSS box ---- */
	const resize = () => {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (w && h) {
			viewer.width = w;
			viewer.height = h;
			fitCamera();
		}
	};
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	window.addEventListener('resize', resize);

	return {
		viewer,
		resize,
		fitCamera,
		destroy() {
			observer.disconnect();
			window.removeEventListener('resize', resize);
			viewer.dispose();
		},
	};
}
