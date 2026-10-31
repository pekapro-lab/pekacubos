import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { itemCanvas } from './textures.js'
// Pekaville decor objects built by code: wooden sign with "Pekaville" lettering, table, chairs, rug,
// armour stands with full armour sets and wall racks showing swords, tools and armour pieces.
function box(w, h, d, x, y, z, col) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z)
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3)
  const sh = [0.78, 0.78, 1, 0.5, 0.9, 0.66]
  for (let i = 0; i < n; i++) { const k = sh[Math.floor(i / 4)]; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g
}
const WOODC = 0x9a6a38, DARK = 0x5a3a1c
const TIERS = { iron: [0xd3d8de, 0x9aa1aa], gold: [0xf2c84a, 0xb88a1c], gem: [0x5ff0d8, 0x1fa89a] }
function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d')
  g.fillStyle = '#a8743c'; g.fillRect(0, 0, 256, 96)
  for (let y = 0; y < 96; y += 4) { g.fillStyle = `rgba(80,45,15,${0.08 + ((y * 7) % 5) * 0.03})`; g.fillRect(0, y, 256, 2) }
  g.strokeStyle = '#5a3a1c'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 88)
  g.font = 'bold 50px "Trebuchet MS", Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = '#3a2410'; g.fillText(text, 130, 52); g.fillStyle = '#fff3c4'; g.fillText(text, 128, 49)
  g.font = '15px Verdana, sans-serif'; g.fillStyle = '#f6e2a8'; g.fillText('★ Bienvenido ★', 128, 82)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
}
function itemTex(id) { const t = new THREE.CanvasTexture(itemCanvas(id)); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t }

export function buildDecor(list) {
  const root = new THREE.Group(); root.name = 'pekaville-decor'
  const vmat = new THREE.MeshBasicMaterial({ vertexColors: true })
  const mats = [vmat], items = []
  const add = (geo, d, mat) => { if (!mat) { mat = vmat.clone(); mats.push(mat) } const m = new THREE.Mesh(geo, mat); m.position.set(d.x, d.y, d.z); m.rotation.y = d.rot || 0; m.userData = d; root.add(m); items.push(m); return m }
  for (const d of list) {
    if (d.type === 'sign') {
      const posts = mergeGeometries([box(0.14, 1.9, 0.14, -0.9, 0.95, 0, DARK), box(0.14, 1.9, 0.14, 0.9, 0.95, 0, DARK), box(2.1, 0.86, 0.1, 0, 1.45, -0.02, WOODC)])
      add(posts, d)
      const mat = new THREE.MeshBasicMaterial({ map: signTexture(d.text) }); mats.push(mat)
      const front = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.76), mat); front.position.set(0, 1.45, 0.035)
      const back = front.clone(); back.rotation.y = Math.PI; back.position.z = -0.075
      const g = add(new THREE.BufferGeometry(), d); g.add(front, back); g.userData = { ...d, sign: true }
    }
    if (d.type === 'table') add(mergeGeometries([box(1.5, 0.1, 1.0, 0, 0.78, 0, WOODC), ...[[-0.65, -0.4], [0.65, -0.4], [-0.65, 0.4], [0.65, 0.4]].map(([x, z]) => box(0.1, 0.74, 0.1, x, 0.37, z, DARK)),
      box(0.26, 0.04, 0.26, -0.3, 0.85, 0, 0xf0ece0), box(0.26, 0.04, 0.26, 0.35, 0.85, 0.1, 0xf0ece0), box(0.12, 0.18, 0.12, 0, 0.92, -0.2, 0xd04040)]), d)
    if (d.type === 'chair') add(mergeGeometries([box(0.5, 0.08, 0.5, 0, 0.46, 0, WOODC), box(0.5, 0.6, 0.07, 0, 0.8, 0.22, WOODC),
      ...[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => box(0.07, 0.44, 0.07, x, 0.22, z, DARK))]), d)
    if (d.type === 'rug') add(mergeGeometries([box(d.w, 0.02, d.d, 0, 0, 0, 0x9a2a3a), box(d.w - 0.3, 0.025, d.d - 0.3, 0, 0, 0, 0xd8a040), box(d.w - 0.6, 0.03, d.d - 0.6, 0, 0, 0, 0x2a4a8a)]), d)
    if (d.type === 'stand') {
      const [a, b] = TIERS[d.tier]
      add(mergeGeometries([box(0.7, 0.08, 0.5, 0, 0.04, 0, 0x8a8a8a), box(0.1, 1.5, 0.1, 0, 0.8, 0, DARK), box(0.9, 0.08, 0.1, 0, 1.35, 0, DARK),
        box(0.5, 0.18, 0.32, 0, 0.65, 0, b), box(0.2, 0.55, 0.26, -0.13, 0.35, 0, a), box(0.2, 0.55, 0.26, 0.13, 0.35, 0, a), // greaves
        box(0.22, 0.12, 0.32, -0.13, 0.08, 0.03, b), box(0.22, 0.12, 0.32, 0.13, 0.08, 0.03, b), // boots
        box(0.56, 0.62, 0.32, 0, 1.08, 0, a), box(0.6, 0.1, 0.34, 0, 1.38, 0, b), box(0.2, 0.42, 0.26, -0.4, 1.18, 0, a), box(0.2, 0.42, 0.26, 0.4, 1.18, 0, a), // chestplate + shoulders
        box(0.38, 0.38, 0.38, 0, 1.68, 0, a), box(0.3, 0.08, 0.04, 0, 1.66, -0.2, 0x202020), box(0.42, 0.06, 0.42, 0, 1.5, 0, b)]), d) // helmet + visor
    }
    if (d.type === 'rack') {
      const n = d.items.length, w = n * 0.62 + 0.2
      const g = add(box(w, 0.9, 0.06, 0, 0, 0.03, DARK), d)
      d.items.forEach((id, i) => {
        const mat = new THREE.MeshBasicMaterial({ map: itemTex(id), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }); mats.push(mat)
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), mat); p.position.set(-w / 2 + 0.41 + i * 0.62, 0, 0.08); g.add(p)
        const fr = new THREE.Mesh(box(0.6, 0.6, 0.02, 0, 0, 0, WOODC), vmat); fr.position.set(p.position.x, 0, 0.065); g.add(fr)
      })
    }
  }
  return { root, mats, items }
}
