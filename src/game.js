import * as THREE from 'three'
import { AIR, WATER, BEDROCK, BLOCKS, HOTBAR, PLANKS, GLASS, BRICK, isSolid } from './blocks.js'
import { World, CS, CH, ckey } from './world.js'
import { buildChunk } from './mesher.js'
import { makeAtlas, makeCracks, makeSkin, NT } from './textures.js'
import { Sfx } from './audio.js'

const SAVE_KEY = 'pekacubos.save.v1'
const W = 0.3, HGT = 1.8, EYE = 1.62, REACH = 6, DAY = 600
const SKY_DAY = new THREE.Color(0x8ccbf0), SKY_NIGHT = new THREE.Color(0x0a0f24)

export class Game {
  constructor(canvas) {
    this.canvas = canvas
    const mobile = matchMedia('(pointer: coarse)').matches
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75))
    this.renderer.autoClear = false
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 400); this.camera.rotation.order = 'YXZ'
    this.scene.fog = new THREE.Fog(SKY_DAY, 30, 60)
    const atlas = makeAtlas(); this.atlas = atlas
    this.matSolid = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true, alphaTest: 0.5 })
    this.matWater = new THREE.MeshBasicMaterial({ map: atlas.tex, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide })
    this.meshes = new Map(); this.queue = []
    this.sfx = new Sfx()
    this.viewDist = 4; this.time = 0.3; this.running = false; this.manual = false
    this.input = { mx: 0, mz: 0, jump: false, breaking: false }
    this.player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: false, inWater: false }
    this.inv = {}; this.sel = 0
    this.brk = { key: null, t: 0 }; this.swing = 0; this.bob = 0; this.stepAcc = 0; this.placeCd = 0
    this.listeners = new Set()
    this.initCrack(); this.initHand(); this.initHighlight()
    this.resize(); addEventListener('resize', () => this.resize())
    let last = performance.now()
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t
      this.frameMs = dt * 1000
      if (this.running && !this.manual) this.update(dt)
      if (this.world) this.render()
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    setInterval(() => this.running && this.save(), 5000)
  }
  emit() { for (const f of this.listeners) f() }
  // ---------- world lifecycle ----------
  newWorld(seed = (Math.random() * 1e9) | 0) {
    this.clearMeshes()
    this.world = new World(seed); this.world.onChange = (x, y, z) => this.dirty(x, z)
    this.inv = { [PLANKS]: 32, [GLASS]: 16, [BRICK]: 16 }; this.sel = 6; this.time = 0.3
    this.spawn(); this.save(); this.emit()
  }
  spawn() {
    const w = this.world
    for (let r = 0; r < 200; r++) {
      const x = Math.floor(Math.cos(r) * r * 2) + 8, z = Math.floor(Math.sin(r) * r * 2) + 8
      const s = w.surface(x, z)
      if (s.b !== WATER && s.b !== 7 /*leaves*/) { this.player.pos.set(x + 0.5, s.y + 1, z + 0.5); break }
    }
    this.player.vel.set(0, 0, 0); this.player.yaw = 0; this.player.pitch = -0.2
  }
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!s || s.v !== 1) return false
      this.clearMeshes()
      this.world = new World(s.seed); this.world.loadMods(s.mods || {}); this.world.onChange = (x, y, z) => this.dirty(x, z)
      this.inv = s.inv || {}; this.sel = s.sel || 0; this.time = s.time ?? 0.3
      const p = s.player; this.player.pos.set(p.x, p.y, p.z); this.player.yaw = p.yaw; this.player.pitch = p.pitch; this.player.vel.set(0, 0, 0)
      this.emit(); return true
    } catch { return false }
  }
  hasSave() { return !!localStorage.getItem(SAVE_KEY) }
  save() {
    if (!this.world) return
    const p = this.player.pos
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, seed: this.world.seed, mods: this.world.serializeMods(), inv: this.inv, sel: this.sel, time: this.time,
      player: { x: p.x, y: p.y, z: p.z, yaw: this.player.yaw, pitch: this.player.pitch } }))
  }
  // ---------- chunk meshes ----------
  clearMeshes() { for (const m of this.meshes.values()) this.disposeEntry(m); this.meshes.clear() }
  disposeEntry(e) { for (const m of [e.solid, e.water]) if (m) { this.scene.remove(m); m.geometry.dispose() } }
  dirty(x, z) {
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS), lx = x - cx * CS, lz = z - cz * CS
    this.rebuild(cx, cz)
    if (lx === 0) this.rebuild(cx - 1, cz); if (lx === CS - 1) this.rebuild(cx + 1, cz)
    if (lz === 0) this.rebuild(cx, cz - 1); if (lz === CS - 1) this.rebuild(cx, cz + 1)
  }
  rebuild(cx, cz) {
    const k = ckey(cx, cz); const old = this.meshes.get(k); if (!old) return
    this.disposeEntry(old); this.meshes.set(k, this.makeEntry(cx, cz))
  }
  makeEntry(cx, cz) {
    const g = buildChunk(this.world, cx, cz), e = { cx, cz }
    if (g.solid) { e.solid = new THREE.Mesh(g.solid, this.matSolid); e.solid.matrixAutoUpdate = false; this.scene.add(e.solid) }
    if (g.water) { e.water = new THREE.Mesh(g.water, this.matWater); e.water.matrixAutoUpdate = false; e.water.renderOrder = 1; this.scene.add(e.water) }
    return e
  }
  updateChunks(budget = 2) {
    const pcx = Math.floor(this.player.pos.x / CS), pcz = Math.floor(this.player.pos.z / CS), r = this.viewDist
    for (const [k, e] of this.meshes) if (Math.max(Math.abs(e.cx - pcx), Math.abs(e.cz - pcz)) > r + 1) { this.disposeEntry(e); this.meshes.delete(k) }
    const want = []
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > (r + 0.5) * (r + 0.5)) continue
      if (!this.meshes.has(ckey(pcx + dx, pcz + dz))) want.push([dx * dx + dz * dz, pcx + dx, pcz + dz])
    }
    want.sort((a, b) => a[0] - b[0])
    for (let i = 0; i < Math.min(budget, want.length); i++) { const [, cx, cz] = want[i]; this.meshes.set(ckey(cx, cz), this.makeEntry(cx, cz)) }
    this.pendingChunks = Math.max(0, want.length - budget)
    const far = r * CS; this.scene.fog.near = far * 0.55; this.scene.fog.far = far * 0.95
  }
  // ---------- physics ----------
  solidAt(x, y, z) { return isSolid(this.world.get(x, y, z)) }
  boxHits(p) {
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + HGT - 1e-4); y++)
      for (let z = Math.floor(p.z - W); z <= Math.floor(p.z + W - 1e-4); z++)
        for (let x = Math.floor(p.x - W); x <= Math.floor(p.x + W - 1e-4); x++) if (this.solidAt(x, y, z)) return true
    return false
  }
  moveAxis(ax, d) {
    const p = this.player.pos; if (!d) return
    p[ax] += d
    if (!this.boxHits(p)) return
    if (ax === 'y') { if (d < 0) { p.y = Math.floor(p.y) + 1; this.player.onGround = true } else p.y = Math.floor(p.y + HGT) - HGT - 1e-3 }
    else { const e = d > 0 ? Math.floor(p[ax] + W) - W - 1e-3 : Math.floor(p[ax] - W) + 1 + W + 1e-3; p[ax] = e }
    this.player.vel[ax] = 0
  }
  physics(dt) {
    const pl = this.player, inp = this.input
    const feet = this.world.get(Math.floor(pl.pos.x), Math.floor(pl.pos.y + 0.4), Math.floor(pl.pos.z))
    pl.inWater = feet === WATER
    const sp = pl.inWater ? 2.2 : 4.3
    const len = Math.hypot(inp.mx, inp.mz) || 1, k = Math.min(1, len) / len
    const sx = inp.mx * k, sz = inp.mz * k, s = Math.sin(pl.yaw), c = Math.cos(pl.yaw)
    // forward is -z in camera space
    const vx = (sx * c - sz * s) * sp, vz = (-sx * s - sz * c) * sp
    pl.vel.x = vx; pl.vel.z = vz
    if (pl.inWater) { pl.vel.y -= 9 * dt; if (inp.jump) pl.vel.y = 3; pl.vel.y = Math.max(pl.vel.y, -3) }
    else { pl.vel.y -= 28 * dt; if (inp.jump && pl.onGround) pl.vel.y = 8.6; pl.vel.y = Math.max(pl.vel.y, -40) }
    pl.onGround = false
    const steps = Math.ceil(Math.max(Math.abs(pl.vel.x), Math.abs(pl.vel.y), Math.abs(pl.vel.z)) * dt / 0.3) || 1
    for (let i = 0; i < steps; i++) { this.moveAxis('y', pl.vel.y * dt / steps); this.moveAxis('x', pl.vel.x * dt / steps); this.moveAxis('z', pl.vel.z * dt / steps) }
    if (pl.pos.y < -20) this.spawn()
    const moving = pl.onGround && (Math.abs(vx) + Math.abs(vz) > 0.1)
    if (moving) { this.bob += dt * 9; this.stepAcc += Math.hypot(vx, vz) * dt; if (this.stepAcc > 2.2) { this.stepAcc = 0; const b = this.world.get(Math.floor(pl.pos.x), Math.floor(pl.pos.y - 0.1), Math.floor(pl.pos.z)); if (BLOCKS[b]) this.sfx.step(BLOCKS[b].sound) } }
    else this.bob *= 0.9
  }
  // ---------- interaction ----------
  dir() { const p = this.player; return new THREE.Vector3(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)) }
  eye() { return this.player.pos.clone().add(new THREE.Vector3(0, EYE, 0)) }
  raycast() {
    const o = this.eye(), d = this.dir()
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z)
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z)
    const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z)
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz
    let n = [0, 0, 0], t = 0
    while (t <= REACH) {
      const id = this.world.get(x, y, z)
      if (id !== AIR && id !== WATER) return { x, y, z, n, id }
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0] }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0] }
      else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz] }
    }
    return null
  }
  selected() { return HOTBAR[this.sel] }
  place() {
    const h = this.raycast(); if (!h) return false
    const id = this.selected(); if (!(this.inv[id] > 0)) { this.toast?.('No te quedan bloques de ' + BLOCKS[id].name.toLowerCase()); return false }
    const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2]
    const cur = this.world.get(x, y, z); if (cur !== AIR && cur !== WATER) return false
    if (y < 1 || y >= CH) return false
    const p = this.player.pos
    if (x + 1 > p.x - W && x < p.x + W && z + 1 > p.z - W && z < p.z + W && y + 1 > p.y && y < p.y + HGT) return false
    this.world.set(x, y, z, id); this.inv[id]--; this.swing = 1; this.sfx.place(BLOCKS[id].sound); this.emit(); return true
  }
  updateBreak(dt) {
    const h = this.input.breaking ? this.raycast() : null
    if (!h || BLOCKS[h.id].hard === Infinity) { this.brk.key = null; this.brk.t = 0; this.crack.visible = false; return }
    const key = h.x + ',' + h.y + ',' + h.z
    if (key !== this.brk.key) { this.brk.key = key; this.brk.t = 0 }
    this.brk.t += dt; this.swing = Math.max(this.swing, 0.01)
    const f = this.brk.t / BLOCKS[h.id].hard
    if (((this.brk.t * 5) | 0) !== (((this.brk.t - dt) * 5) | 0)) this.sfx.dig(BLOCKS[h.id].sound)
    if (f >= 1) {
      this.world.set(h.x, h.y, h.z, AIR); this.inv[h.id] = (this.inv[h.id] || 0) + 1
      this.sfx.brk(BLOCKS[h.id].sound); this.brk.key = null; this.brk.t = 0; this.crack.visible = false; this.emit(); return
    }
    this.crack.visible = true; this.crack.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5)
    this.crack.material.map = this.cracks[Math.min(5, Math.floor(f * 6))]
  }
  initCrack() {
    this.cracks = makeCracks()
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({ map: this.cracks[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }))
    this.crack.visible = false; this.scene.add(this.crack)
  }
  initHighlight() {
    this.hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)), new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.6 }))
    this.hl.visible = false; this.scene.add(this.hl)
  }
  initHand() {
    this.handScene = new THREE.Scene(); this.handCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10)
    const { skin, sleeve } = makeSkin()
    this.hand = new THREE.Group()
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.7), new THREE.MeshBasicMaterial({ map: skin }))
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.28), new THREE.MeshBasicMaterial({ map: sleeve })); cuff.position.z = 0.3
    this.hand.add(arm, cuff)
    this.held = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.21, 0.21), this.matSolid.clone()); this.held.material.vertexColors = false
    this.held.position.set(-0.04, 0.17, -0.34)
    this.hand.add(this.held)
    this.hand.position.set(0.42, -0.42, -0.6); this.hand.rotation.set(0.15, 0.25, 0)
    this.handScene.add(this.hand)
  }
  setHeldUV(id) {
    const g = this.held.geometry, uv = g.attributes.uv, B = BLOCKS[id]
    // BoxGeometry face order: +x,-x,+y,-y,+z,-z
    const slot = [1, 1, 0, 2, 1, 1]
    for (let f = 0; f < 6; f++) { const t = B.tiles[slot[f]]; for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setX(i, (t + (k % 2)) / NT) } }
    uv.needsUpdate = true; this.heldId = id
  }
  updateHand(dt) {
    const id = this.selected(); this.held.visible = this.inv[id] > 0
    if (this.heldId !== id) this.setHeldUV(id)
    if (this.input.breaking && this.brk.key) this.swing = this.swing <= 0 ? 1 : this.swing
    const s = this.swing > 0 ? Math.sin((1 - this.swing) * Math.PI) : 0
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 4)
    const bx = Math.sin(this.bob) * 0.035, by = -Math.abs(Math.cos(this.bob)) * 0.03
    this.hand.position.set(0.48 + bx - s * 0.12, -0.46 + by + s * 0.08, -0.72 - s * 0.1)
    this.hand.rotation.set(0.15 - s * 0.9, 0.25 + s * 0.2, 0)
  }
  // ---------- frame ----------
  update(dt) {
    this.physics(dt)
    this.updateBreak(dt)
    this.time = (this.time + dt / DAY) % 1
    this.updateChunks()
    this.updateHand(dt)
    this.placeCd -= dt
  }
  advance(sec, fps = 60) { const n = Math.round(sec * fps); for (let i = 0; i < n; i++) this.update(1 / fps) }
  daylight() { return Math.min(1, Math.max(0.18, 0.55 + 0.75 * Math.sin((this.time - 0.25) * Math.PI * 2 + Math.PI / 2))) }
  render() {
    const p = this.player, c = this.camera
    c.position.copy(p.pos); c.position.y += EYE + (p.onGround ? Math.abs(Math.sin(this.bob)) * 0.05 : 0)
    c.rotation.set(p.pitch, p.yaw, 0)
    const L = this.daylight()
    const sky = SKY_NIGHT.clone().lerp(SKY_DAY, (L - 0.18) / 0.82)
    this.scene.fog.color.copy(sky); this.renderer.setClearColor(sky)
    this.matSolid.color.setScalar(L); this.matWater.color.setScalar(L); this.held.material.color.setScalar(Math.max(0.5, L))
    const h = this.running ? this.raycast() : null
    this.hl.visible = !!h; if (h) this.hl.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5)
    this.renderer.clear(); this.renderer.render(this.scene, c)
    this.renderer.clearDepth(); this.renderer.render(this.handScene, this.handCam)
  }
  resize() {
    const w = innerWidth, h = innerHeight
    this.renderer.setSize(w, h, false); this.camera.aspect = this.handCam ? w / h : 1; this.camera.updateProjectionMatrix()
    if (this.handCam) { this.handCam.aspect = w / h; this.handCam.updateProjectionMatrix() }
  }
}
