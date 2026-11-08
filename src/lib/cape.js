/**
 * The cape: a small cloth shell, not a plane.
 *
 * Two sheets of a bowed grid, joined along both sides and the hem, so the cloth
 * has real thickness and curves around the back instead of hanging like a card.
 * The top edge tapers to zero thickness and narrows to the shoulders, which is
 * what makes it read as attached at the shoulder line rather than floating
 * behind the head.
 *
 * Rows run through a damped spring each: swing the model and the hem trails
 * behind, then settles into a slow idle sway.
 */

/* Cape texture: the cape occupies pixels (1,1)-(10,16) of a 64x32 sheet.
   Texture v runs bottom-up with flipY, hence the inversion. */
const CAPE_UV = {
	u0: 1 / 64,
	u1: 11 / 64,
	vTop: 1 - 1 / 32,
	vBottom: 1 - 17 / 32,
};

const COLS = 8;
const ROWS = 14;
const HEIGHT = 16;
const THICKNESS = 0.4;
/** how far the middle of the cape bows away from the back plane */
const BOW = 1.15;
/** width at the shoulders and at the hem: it flares downwards */
const TOP_WIDTH = 9;
const HEM_WIDTH = 10.6;

function smoothstep(edge0, edge1, x) {
	const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

/** Local point of the cape for u (0 left … 1 right), v (0 top … 1 hem) and side. */
function point(u, v, inner) {
	const width = TOP_WIDTH + (HEM_WIDTH - TOP_WIDTH) * v;
	const x = (u - 0.5) * width;
	const y = -v * HEIGHT;
	// flat against the back at the shoulders, then it drapes away from the body
	const drape = smoothstep(0.02, 0.45, v);
	const bow = BOW * (1 - Math.pow(2 * u - 1, 2)) * drape;
	// zero at the shoulders so the two sheets meet where the cape is attached
	const thickness = THICKNESS * smoothstep(0.04, 0.18, v);
	const z = -(0.04 + bow) + (inner ? thickness : 0);
	return [x, y, z];
}

export function buildCape(THREE, url) {
	const positions = [];
	const uvs = [];
	const indices = [];
	const metaU = [];
	const metaV = [];

	function addSheet(inner) {
		const base = positions.length / 3;
		for (let r = 0; r <= ROWS; r++) {
			const v = r / ROWS;
			for (let c = 0; c <= COLS; c++) {
				const u = c / COLS;
				const [x, y, z] = point(u, v, inner);
				positions.push(x, y, z);
				// the cloth mirrors the art, so the u axis is flipped here
				uvs.push(CAPE_UV.u1 - u * (CAPE_UV.u1 - CAPE_UV.u0), CAPE_UV.vTop + v * (CAPE_UV.vBottom - CAPE_UV.vTop));
				metaU.push(u);
				metaV.push(v);
			}
		}
		for (let r = 0; r < ROWS; r++) {
			for (let c = 0; c < COLS; c++) {
				const a = base + r * (COLS + 1) + c;
				const b = a + 1;
				const d = a + COLS + 1;
				const e = d + 1;
				if (inner) indices.push(a, b, d, b, e, d);
				else indices.push(a, d, b, b, d, e);
			}
		}
		return base;
	}

	const outerBase = addSheet(false);
	const innerBase = addSheet(true);

	function stack(base) {
		return (r, c) => base + r * (COLS + 1) + c;
	}
	const outer = stack(outerBase);
	const inner = stack(innerBase);

	// side walls, so the cloth has an edge instead of being paper thin
	for (let r = 0; r < ROWS; r++) {
		for (const c of [0, COLS]) {
			const o0 = outer(r, c);
			const o1 = outer(r + 1, c);
			const i0 = inner(r, c);
			const i1 = inner(r + 1, c);
			indices.push(o0, o1, i0, o1, i1, i0);
		}
	}

	// hem
	for (let c = 0; c < COLS; c++) {
		const o0 = outer(ROWS, c);
		const o1 = outer(ROWS, c + 1);
		const i0 = inner(ROWS, c);
		const i1 = inner(ROWS, c + 1);
		indices.push(o0, i0, o1, o1, i0, i1);
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
		roughness: 0.9,
		metalness: 0,
		alphaTest: 0.45,
	});

	const mesh = new THREE.Mesh(geometry, material);
	mesh.name = 'cape';

	const rest = Float32Array.from(positions);
	const rowOffset = new Float32Array(ROWS + 1);
	const rowVelocity = new Float32Array(ROWS + 1);
	const vertexCount = positions.length / 3;
	let trail = 0;

	return {
		mesh,
		update(dt, time, dragSpeed, energy) {
			// the cape lags behind whatever the model is doing
			trail += (dragSpeed - trail) * Math.min(1, dt * 5);

			for (let r = 1; r <= ROWS; r++) {
				const k = r / ROWS;
				const wind = Math.sin(time * 2.0 - k * 2.6) * 0.85 * k * energy;
				// clamp the drag contribution: a fast flick should flare the hem,
				// not turn the cape into a sail
				const target = wind + Math.max(-2.2, Math.min(2.2, trail)) * 1.7 * k;
				rowVelocity[r] += (target - rowOffset[r]) * 62 * dt;
				rowVelocity[r] *= Math.pow(0.02, dt);
				rowOffset[r] += rowVelocity[r] * dt;
				// it may swing far away from the body, but only a little towards it,
				// or the cloth would pass through the back and the legs
				if (rowOffset[r] > 0.55) rowOffset[r] = 0.55;
				if (rowOffset[r] < -3.2) rowOffset[r] = -3.2;
			}

			const pos = geometry.attributes.position.array;
			for (let i = 0; i < vertexCount; i++) {
				const v = metaV[i];
				const u = metaU[i];
				const row = Math.round(v * ROWS);
				const i3 = i * 3;
				const sway = Math.sin(time * 1.5 - v * 2.2) * 0.34 * v * energy;
				pos[i3] = rest[i3] + sway * (u - 0.5) * 2;
				pos[i3 + 1] = rest[i3 + 1] + Math.abs(rowOffset[row]) * 0.18 * v;
				pos[i3 + 2] = rest[i3 + 2] + rowOffset[row];
			}
			geometry.attributes.position.needsUpdate = true;
			geometry.computeVertexNormals();
		},
	};
}
