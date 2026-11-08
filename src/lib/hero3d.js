/**
 * hero3d.js — the live, draggable hero character.
 *
 * Replaces the pre-rendered PNG with a real 3D player built from the same two
 * textures the rest of the site uses (assets/skin-texture.png + assets/cape.png),
 * so the visitor can drag the model around and see the back of it.
 *
 * Three pieces, all in model units (1 unit = 1/16 block, player is 32 tall):
 *   - the character: skinview3d's SkinViewer, skin loaded from the texture
 *   - the cape: a segmented cloth mesh whose vertices run through a small
 *     spring simulation, because skinview3d's own cape is a rigid plane
 *   - the crossbow: box geometry, attached to the body so it rotates with it
 *
 * No build step: three and skinview3d are vendored UMD bundles loaded on
 * demand, so a failure here leaves the static PNG in place instead of an
 * empty hero.
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

/** A box-built crossbow: wooden stock, bow limbs, drawn string, loaded bolt. */
function buildCrossbow(THREE) {
	const group = new THREE.Group();
	const wood = new THREE.MeshStandardMaterial({ color: 0x6d4526, roughness: 0.85, metalness: 0.04 });
	const limb = new THREE.MeshStandardMaterial({ color: 0x412a17, roughness: 0.8 });
	const string = new THREE.MeshStandardMaterial({ color: 0xf3efe2, roughness: 0.65 });
	const iron = new THREE.MeshStandardMaterial({ color: 0xb4bcc4, roughness: 0.35, metalness: 0.55 });

	const stock = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 7.6), wood);
	group.add(stock);

	const grip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.3, 1.7), limb);
	grip.position.set(0, -1.5, -0.7);
	group.add(grip);

	const limbs = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.95, 1.15), limb);
	limbs.position.set(0, 0.1, 1.5);
	limbs.rotation.x = 0.14;
	group.add(limbs);

	// drawn back behind the limbs: that is what makes it read as loaded
	const drawString = new THREE.Mesh(new THREE.BoxGeometry(7.9, 0.24, 0.24), string);
	drawString.position.set(0, 0.1, -0.35);
	group.add(drawString);

	const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 6.2), iron);
	bolt.position.set(0, 0.62, 2.1);
	group.add(bolt);

	return group;
}

export async function initHero3D(canvas, { skinUrl, capeUrl }) {
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
	const width = Math.round(frame?.width || canvas.clientWidth || 360);
	const height = Math.round(frame?.height || canvas.clientHeight || 409);

	const viewer = new skinview3d.SkinViewer({
		canvas,
		width,
		height,
		skin: skinUrl,
		model: 'auto-detect',
	});

	viewer.controls.enableRotate = true;
	viewer.controls.enableZoom = false;
	viewer.controls.enablePan = false;
	viewer.controls.minPolarAngle = 0.7;
	viewer.controls.maxPolarAngle = 2.4;
	viewer.controls.rotateSpeed = 0.85;
	viewer.zoom = 0.92;
	viewer.autoRotate = !reduced;
	viewer.autoRotateSpeed = 0.9;

	const body = viewer.playerObject.skin || viewer.playerObject;

	// Mount points are measured off the model rather than hardcoded: the player
	// is 32 units tall but the group origin sits somewhere inside it, so the
	// bbox gives the frame and the right-arm mesh gives the grip position.
	body.updateWorldMatrix(true, true);
	const bounds = new THREE.Box3().setFromObject(body);
	const size = bounds.getSize(new THREE.Vector3());
	const arm = body.getObjectByName('rightArm') || body.getObjectByName('RightArm') || null;
	const armBox = arm ? new THREE.Box3().setFromObject(arm) : null;

	const cape = buildCape(THREE, capeUrl);
	const shoulder = new THREE.Vector3(
		(bounds.min.x + bounds.max.x) / 2,
		bounds.max.y - size.y * 0.245,
		bounds.min.z - 0.15
	);
	cape.mesh.position.copy(body.worldToLocal(shoulder));
	body.add(cape.mesh);

	const crossbow = buildCrossbow(THREE);
	crossbow.scale.setScalar(0.6);
	crossbow.rotation.set(0.12, Math.PI, -0.16);
	const grip = armBox
		? new THREE.Vector3(
				(armBox.min.x + armBox.max.x) / 2,
				armBox.min.y + (armBox.max.y - armBox.min.y) * 0.18,
				armBox.max.z + 0.3
			)
		: new THREE.Vector3(
				bounds.min.x + size.x * 0.14,
				bounds.min.y + size.y * 0.42,
				bounds.max.z + 0.3
			);
	crossbow.position.copy(body.worldToLocal(grip));
	body.add(crossbow);

	/* ---- pointer: drag to orbit, with velocity feeding the cape ---- */
	let dragSpeed = 0;
	let lastX = 0;
	let lastT = 0;
	let resumeTimer = 0;
	let dragging = false;

	const onDown = (event) => {
		dragging = true;
		lastX = event.clientX;
		lastT = performance.now();
		viewer.autoRotate = false;
		canvas.classList.add('is-dragging');
		window.clearTimeout(resumeTimer);
	};

	const onMove = (event) => {
		if (!dragging) return;
		const now = performance.now();
		const dt = Math.max(16, now - lastT);
		dragSpeed = Math.min(6, Math.abs(event.clientX - lastX) / dt * 12);
		lastX = event.clientX;
		lastT = now;
	};

	const onUp = () => {
		if (!dragging) return;
		dragging = false;
		canvas.classList.remove('is-dragging');
		if (reduced) return;
		resumeTimer = window.setTimeout(() => {
			viewer.autoRotate = true;
		}, 2600);
	};

	canvas.addEventListener('pointerdown', onDown);
	window.addEventListener('pointermove', onMove, { passive: true });
	window.addEventListener('pointerup', onUp);
	window.addEventListener('pointercancel', onUp);
	canvas.addEventListener('keydown', (event) => {
		// keyboard spin for anyone who cannot drag
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			viewer.playerWrapper.rotation.y += event.key === 'ArrowLeft' ? -0.22 : 0.22;
		}
	});

	/* ---- frame loop: cloth simulation ---- */
	let last = performance.now();
	let raf = 0;
	const tick = (now) => {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
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
		}
	};
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);

	return {
		viewer,
		cape,
		crossbow,
		resize,
		destroy() {
			cancelAnimationFrame(raf);
			observer.disconnect();
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			viewer.dispose();
		},
	};
}
