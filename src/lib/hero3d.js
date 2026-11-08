/**
 * hero3d.js — the live hero character, standing on the ground.
 *
 * Two pieces, both in model units (1 unit = 1/16 block, player is 32 tall):
 *   - the character: skinview3d's SkinViewer, standing still with its arms at
 *     its sides — no props, no animation, just the skin as it is in game
 *   - the cape: a segmented cloth mesh whose rows run through a damped spring,
 *     so it keeps a little life while the model turns
 *
 * The figure stands on a soft contact shadow placed at the model's own foot
 * height, and `groundRatio()` reports where the feet land in canvas space so the
 * page can draw its plinth line through them.
 *
 * three and skinview3d are vendored UMD bundles loaded on demand.
 */

const ASSET_BASE = import.meta.env?.BASE_URL ?? "./";
const THREE_SRC = `${ASSET_BASE}vendor/three/three.min.js`;
const SKINVIEW_SRC = `${ASSET_BASE}vendor/skinview3d/skinview3d.bundle.js`;

/* Cape texture: the cape occupies pixels (1,1)-(10,16) of a 64x32 sheet.
   Texture v runs bottom-up with flipY, hence the inversion. */
const CAPE_UV = {
	u0: 1 / 64,
	u1: 11 / 64,
	vTop: 1 - 1 / 32,
	vBottom: 1 - 17 / 32,
};

const CAPE_COLS = 6;
const CAPE_ROWS = 12;
const CAPE_W = 10;
const CAPE_H = 16;

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

/**
 * A hanging cloth grid whose rows are driven by a damped spring each, plus a
 * travelling sine across the width. The springs are what give it inertia:
 * swing the model and the cape trails behind, then settles.
 */
function buildCape(THREE, url) {
	const positions = [];
	const uvs = [];
	const indices = [];

	for (let r = 0; r <= CAPE_ROWS; r++) {
		const v = r / CAPE_ROWS;
		for (let c = 0; c <= CAPE_COLS; c++) {
			const u = c / CAPE_COLS;
			positions.push(-CAPE_W / 2 + u * CAPE_W, -v * CAPE_H, 0);
			// u is mirrored along with the mesh, so flip it to keep the art readable
			uvs.push(CAPE_UV.u1 - u * (CAPE_UV.u1 - CAPE_UV.u0), CAPE_UV.vTop + v * (CAPE_UV.vBottom - CAPE_UV.vTop));
		}
	}

	for (let r = 0; r < CAPE_ROWS; r++) {
		for (let c = 0; c < CAPE_COLS; c++) {
			const a = r * (CAPE_COLS + 1) + c;
			const b = a + 1;
			const d = a + CAPE_COLS + 1;
			const e = d + 1;
			indices.push(a, d, b, b, d, e);
		}
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geometry.setIndex(indices);

	const texture = new THREE.TextureLoader().load(url);
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.generateMipmaps = false;
	if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;

	const material = new THREE.MeshStandardMaterial({
		map: texture,
		side: THREE.DoubleSide,
		roughness: 0.92,
		metalness: 0,
		alphaTest: 0.45,
	});

	const mesh = new THREE.Mesh(geometry, material);
	// shoulders sit at the top of the torso (y=24), cape hangs down the back
	mesh.position.set(0, 24.2, -2.15);
	mesh.rotation.y = Math.PI;

	const rest = Float32Array.from(positions);
	const rowOffset = new Float32Array(CAPE_ROWS + 1);
	const rowVelocity = new Float32Array(CAPE_ROWS + 1);
	let trail = 0;

	return {
		mesh,
		update(dt, time, dragSpeed, energy) {
			// the cape lags behind whatever the model is doing
			trail += (dragSpeed - trail) * Math.min(1, dt * 5);

			for (let r = 1; r <= CAPE_ROWS; r++) {
				const k = r / CAPE_ROWS;
				const wind = Math.sin(time * 2.0 - k * 2.6) * 0.85 * k * energy;
				// clamp the drag contribution: a fast flick should flare the hem,
				// not turn the cape into a sail
				const target = wind + Math.max(-2.2, Math.min(2.2, trail)) * 1.7 * k;
				rowVelocity[r] += (target - rowOffset[r]) * 62 * dt;
				rowVelocity[r] *= Math.pow(0.02, dt);
				rowOffset[r] += rowVelocity[r] * dt;
				if (rowOffset[r] > 3.2) rowOffset[r] = 3.2;
				if (rowOffset[r] < -3.2) rowOffset[r] = -3.2;
			}

			const pos = geometry.attributes.position.array;
			for (let r = 0; r <= CAPE_ROWS; r++) {
				const k = r / CAPE_ROWS;
				const sway = Math.sin(time * 1.5 - k * 2.2) * 0.3 * k * energy;
				const lift = Math.abs(rowOffset[r]) * 0.18 * k;
				for (let c = 0; c <= CAPE_COLS; c++) {
					const i = (r * (CAPE_COLS + 1) + c) * 3;
					pos[i] = rest[i] + sway * (c / CAPE_COLS - 0.5) * 2;
					pos[i + 1] = rest[i + 1] + lift;
					pos[i + 2] = rest[i + 2] + rowOffset[r];
				}
			}
			geometry.attributes.position.needsUpdate = true;
			geometry.computeVertexNormals();
		},
	};
}

export async function initHero3D(canvas, { skinUrl, capeUrl, onGround }) {
	await loadScript(THREE_SRC);
	await loadScript(SKINVIEW_SRC);

	const THREE = window.THREE;
	const skinview3d = window.skinview3d;
	if (!THREE || !skinview3d) throw new Error('three / skinview3d did not register');

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
	// idle pose with its arms down.
	viewer.controls.enableRotate = true;
	viewer.controls.enableZoom = false;
	viewer.controls.enablePan = false;
	viewer.controls.minPolarAngle = 1.18;
	viewer.controls.maxPolarAngle = 1.72;
	viewer.zoom = 1;
	viewer.autoRotate = false;
	// The model turns only when it is dragged. skinview3d's controls rotate on
	// bare pointer movement, which makes the camera drift whenever a cursor
	// crosses the canvas, so they are switched off and the yaw is applied here.
	viewer.controls.enabled = false;

	const body = viewer.playerObject.skin || viewer.playerObject;

	// Mount points are measured off the model rather than hardcoded: the player
	// is 32 units tall but the group origin sits somewhere inside it, so the
	// bbox gives the frame and the right-arm mesh gives the grip position.
	body.updateWorldMatrix(true, true);
	const bounds = new THREE.Box3().setFromObject(body);
	const size = bounds.getSize(new THREE.Vector3());

	const cape = buildCape(THREE, capeUrl);
	const shoulder = new THREE.Vector3(
		(bounds.min.x + bounds.max.x) / 2,
		bounds.max.y - size.y * 0.245,
		bounds.min.z - 0.15
	);
	cape.mesh.position.copy(body.worldToLocal(shoulder));
	body.add(cape.mesh);

	const feet = new THREE.Vector3(0, bounds.min.y, 0);
	const projected = new THREE.Vector3();

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

		feet.set(0, box.min.y, 0);
		notifyGround();
	}

	/**
	 * Report where the feet landed after the camera settles. Called from the fit
	 * and on resize, so the page's plinth line never drifts from the soles.
	 */
	function notifyGround() {
		if (!onGround) return;
		requestAnimationFrame(() => requestAnimationFrame(() => onGround(groundRatio())));
	}

	/** Where the feet sit inside the canvas, 0 = top edge, 1 = bottom edge. */
	function groundRatio() {
		viewer.camera.updateMatrixWorld();
		projected.copy(feet).project(viewer.camera);
		const ratio = (1 - projected.y) / 2;
		return Math.min(1.2, Math.max(0, ratio));
	}

	fitCamera();
	// auto-detect can swap the slim/classic model once the skin decodes
	window.setTimeout(fitCamera, 350);

		/* ---- pointer: drag to turn, with the release velocity carrying on ---- */
	const YAW_PER_PX = 0.008;
	let yaw = 0;
	let spin = 0;
	let dragSpeed = 0;
	let lastX = 0;
	let lastT = 0;
	let dragging = false;

	const onDown = (event) => {
		dragging = true;
		spin = 0;
		lastX = event.clientX;
		lastT = performance.now();
		canvas.classList.add('is-dragging');
		try {
			canvas.setPointerCapture(event.pointerId);
		} catch {
			/* capture is a nicety */
		}
	};

	const onMove = (event) => {
		if (!dragging) return;
		const now = performance.now();
		const dt = Math.max(16, now - lastT);
		const dx = event.clientX - lastX;
		yaw += dx * YAW_PER_PX;
		spin = dx * YAW_PER_PX * 0.55;
		dragSpeed = Math.min(6, (Math.abs(dx) / dt) * 12);
		lastX = event.clientX;
		lastT = now;
	};

	const onUp = () => {
		if (!dragging) return;
		dragging = false;
		canvas.classList.remove('is-dragging');
	};

	canvas.addEventListener('pointerdown', onDown);
	window.addEventListener('pointermove', onMove, { passive: true });
	window.addEventListener('pointerup', onUp);
	window.addEventListener('pointercancel', onUp);
	canvas.addEventListener('keydown', (event) => {
		// keyboard spin for anyone who cannot drag
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			yaw += event.key === 'ArrowLeft' ? -0.2 : 0.2;
		}
	});

	/* ---- frame loop: cloth simulation ---- */
	let last = performance.now();
	let raf = 0;
	const tick = (now) => {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		if (!dragging) {
			yaw += spin;
			spin *= Math.pow(0.02, dt);
		}
		viewer.playerWrapper.rotation.y = yaw;
		cape.update(dt, now / 1000, dragSpeed, reduced ? 0.35 : 1);
		dragSpeed *= Math.pow(0.04, dt);
		raf = requestAnimationFrame(tick);
	};
	raf = requestAnimationFrame(tick);

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
		cape,
		resize,
		fitCamera,
		groundRatio,			destroy() {
			cancelAnimationFrame(raf);
			observer.disconnect();
			window.removeEventListener('resize', resize);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			viewer.dispose();
		},
	};
}
