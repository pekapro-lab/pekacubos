import * as THREE from 'three'
import { AIR, WATER, BLOCKS, ITEMS, HOTBAR, HOTBAR2, PLANKS, GLASS, BRICK, TORCH, LEAVES, STICK, BUCKET, WATER_BUCKET, TABLE, FURNACE, CHEST, TOOL_SOUNDS, isBlock, itemName } from './blocks.js'
import { CHUNKS as VILLAGE_CHUNKS, STARTER_CHEST } from './village.js'
import { buildDecor } from './decor.js'
import { World, CS, CH, ckey } from './world.js'
import { buildChunk } from './mesher.js'
import { makeAtlas, makeCracks, makeSkin, itemCanvas, NT } from './textures.js'
import { Sfx } from './audio.js'
import { boxHits, moveBody } from './physics.js'
import { Mob, MOB_TYPES, rayBox } from './mobs.js'
import { RECIPES, NEED_NAME } from './crafting.js'

// same key as v1 (v1 saves load in v2); the test copy uses its own key so it never touches the real save on the same origin
const SAVE_KEY = 'pekacubos.save.v1' + (import.meta.env.VITE_SAVE_SUFFIX || '')
const W = 0.3, HGT = 1.8, EYE = 1.62, REACH = 6, DAY = 600, MAXHP = 20
const SKY_DAY = new THREE.Color(0x8ccbf0), SKY_NIGHT = new THREE.Color(0x05070f)

const VS = `attribute vec3 light; varying vec2 vUv; varying vec3 vL; varying float vD;
void main(){ vUv = uv; vL = light; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`
const FS = `precision mediump float; uniform sampler2D map; uniform float daylight, moon, opacity, alphaTest, fogNear, fogFar; uniform vec3 fogColor;
varying vec2 vUv; varying vec3 vL; varying float vD;
float lv(float l){ return pow(0.8, (1.0 - l) * 15.0); }
void main(){ vec4 t = texture2D(map, vUv); if (t.a < alphaTest) discard;
  float s = lv(vL.x) * daylight; float b = vL.y > 0.01 ? lv(vL.y) : 0.0;
  vec3 mo = vec3(0.62, 0.72, 1.0) * (lv(vL.x) * moon); // bluish moonlight under open sky
  vec3 lc = max(max(vec3(s) + mo, vec3(b, b * 0.82, b * 0.6)), vec3(0.025));
  vec3 c = t.rgb * lc * vL.z; float f = smoothstep(fogNear, fogFar, vD);
  gl_FragColor = vec4(mix(c, fogColor, f), t.a * opacity); }`

export class Game {
  constructor(canvas) {
    this.canvas = canvas
    const mobile = matchMedia('(pointer: coarse)').matches
    this.mobile = mobile
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' })
    this.basePR = Math.min(devicePixelRatio, mobile ? 1.25 : 1.75); this.quality = 0
    this.renderer.setPixelRatio(this.basePR)
    this.renderer.autoClear = false
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 400); this.camera.rotation.order = 'YXZ'
    const atlas = makeAtlas(); this.atlas = atlas
    const uni = () => ({ map: { value: atlas.tex }, daylight: { value: 1 }, moon: { value: 0 }, opacity: { value: 1 }, alphaTest: { value: 0.5 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 30 }, fogFar: { value: 60 } })
    this.matSolid = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: uni() })
    this.matWater = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: uni(), transparent: true, depthWrite: false, side: THREE.DoubleSide })
    this.matWater.uniforms.opacity.value = 0.72; this.matWater.uniforms.alphaTest.value = 0
    this.meshes = new Map(); this.queue = []; this.inflight = 0; this.jobSeq = 0; this.meshStats = { n: 0, ms: 0, lightMs: 0 }
    this.waterDirty = new Set(); this.waterT = 0
    this.initWorkers()
    this.sfx = new Sfx()
    this.viewDist = 4; this.time = 0.3; this.running = false; this.manual = false; this.autoQuality = true
    this.input = { mx: 0, mz: 0, jump: false, breaking: false }
    this.player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: false, inWater: false, w: W, h: HGT }
    this.inv = {}; this.sel = 0; this.hotbar = HOTBAR2.slice()
    this.hp = MAXHP; this.maxHp = MAXHP; this.dead = false; this.lastHurt = -99; this.regenT = 0; this.fallTop = null; this.hurtFlash = 0
    this.mobs = []; this.mobsEnabled = true; this.spawnT = 0; this.attackCd = 0; this.clock = 0; this.noDamage = false
    this.brk = { key: null, t: 0 }; this.swing = 0; this.bob = 0; this.stepAcc = 0
    this.listeners = new Set()
    this.initCrack(); this.initHand(); this.initHighlight()
    this.resize(); addEventListener('resize', () => this.resize())
    let last = performance.now(); this.ft = []
    const loop = (t) => {
      const raw = (t - last) / 1000, dt = Math.min(0.05, raw); last = t
      this.frameMs = raw * 1000
      if (this.running && !this.manual) { this.update(dt); this.trackPerf(raw) }
      if (this.world) this.render()
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    setInterval(() => this.running && this.save(), 5000)
  }
  emit() { for (const f of this.listeners) f() }
  // ---------- meshing workers ----------
  initWorkers() {
    this.workers = []; this.jobs = new Map(); this.workerOK = false; this.workerMode = 'main'
    if (typeof Worker === 'undefined' || this.noWorkers) return
    try {
      const n = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1))
      for (let i = 0; i < n; i++) {
        const w = new Worker(new URL('./mesh.worker.js', import.meta.url), { type: 'module' })
        w.busy = false
        w.onmessage = (e) => {
          if (!this.workers.includes(w)) return
          const d = e.data; if (!d || d.error || !d.light) { this.workerFail('respuesta inválida: ' + (d && d.error)); return }
          w.busy = false; this.inflight--; this.jobs.delete(d.job); this.workerOK = true; this.applyMesh(d); this.pump()
        }
        w.onerror = (e) => { e.preventDefault?.(); this.workerFail('error: ' + (e.message || 'worker')) }
        w.onmessageerror = () => this.workerFail('messageerror')
        this.workers.push(w)
      }
      this.workerMode = 'worker'; this.workerStart = performance.now()
    } catch (err) { this.workerFail('no se pudo crear: ' + err) }
  }
  // Any worker problem -> terminate them all, re-queue their chunks and mesh on the main thread from now on.
  workerFail(why) {
    if (this.workerMode === 'main' && !this.workers.length) return
    console.warn('[Pekacubos] mesh worker desactivado (' + why + '); mallado en el hilo principal')
    this.workerError = why
    for (const w of this.workers) { try { w.terminate() } catch {} }
    this.workers = []; this.workerMode = 'main'; this.inflight = 0
    for (const j of this.jobs.values()) if (this.meshes.has(j.k) && !this.queue.some((q) => q.k === j.k)) this.queue.unshift({ k: j.k, cx: j.cx, cz: j.cz })
    this.jobs.clear(); this.pump()
  }
  checkWorkers() { // watchdog: a job unanswered for 2 s (or no first answer at all) means the worker is broken
    if (this.workerMode !== 'worker') return
    const now = performance.now()
    for (const j of this.jobs.values()) if (now - j.t > 2000) { this.workerFail('sin respuesta en 2 s'); return }
  }
  neighbourhood(cx, cz) {
    const out = []
    for (let dz = -1; dz <= 1; dz++) { const row = []; for (let dx = -1; dx <= 1; dx++) { const ids = this.world.chunk(cx + dx, cz + dz); row.push({ ids, meta: this.world.metas.get(ckey(cx + dx, cz + dz)) }) } out.push(row) }
    return out
  }
  schedule(cx, cz, front = false) {
    const k = ckey(cx, cz), e = this.meshes.get(k); if (!e) return
    e.ver = (e.ver || 0) + 1
    if (this.queue.some((q) => q.k === k)) { if (front) { this.queue = this.queue.filter((q) => q.k !== k); this.queue.unshift({ k, cx, cz }) } }
    else if (front) this.queue.unshift({ k, cx, cz }); else this.queue.push({ k, cx, cz })
  }
  pump(syncBudget = this.syncBudget ?? 2) {
    let sync = 0
    while (this.queue.length) {
      const free = this.workers.find((w) => !w.busy)
      const q = this.queue[0]; const e = this.meshes.get(q.k)
      if (!e) { this.queue.shift(); continue }
      if (this.workers.length && !free) return
      this.queue.shift()
      const ver = e.ver, data = { job: ++this.jobSeq, chunks: this.neighbourhood(q.cx, q.cz), cx: q.cx, cz: q.cz }
      e.pending = ver
      if (free) {
        try { free.postMessage(data); free.busy = true; this.inflight++; this.jobs.set(data.job, { k: q.k, cx: q.cx, cz: q.cz, t: performance.now() }) }
        catch (err) { this.queue.unshift(q); this.workerFail('postMessage: ' + err); return }
      } else {
        if (sync >= syncBudget) { this.queue.unshift(q); return } // main-thread fallback: a few chunks per frame
        sync++; this.applyMesh({ ...buildChunk(data.chunks, q.cx, q.cz), cx: q.cx, cz: q.cz })
      }
    }
  }
  applyMesh(r) {
    const e = this.meshes.get(ckey(r.cx, r.cz)); if (!e) return
    this.meshStats.n++; this.meshStats.ms += r.ms; this.meshStats.lightMs += r.lightMs
    for (const k of ['solid', 'water']) {
      if (e[k]) { this.scene.remove(e[k]); e[k].geometry.dispose(); e[k] = null }
      const d = r[k]; if (!d) continue
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(d.p, 3)); g.setAttribute('uv', new THREE.BufferAttribute(d.u, 2)); g.setAttribute('light', new THREE.BufferAttribute(d.l, 3))
      g.setIndex(new THREE.BufferAttribute(d.i, 1)); g.computeBoundingSphere()
      const m = new THREE.Mesh(g, k === 'solid' ? this.matSolid : this.matWater); m.matrixAutoUpdate = false
      if (k === 'water') m.renderOrder = 1
      this.scene.add(m); e[k] = m
    }
    e.light = r.light; e.built = true
  }
  async whenIdle(maxMs = 20000) { const t = performance.now(); this.updateChunks(999); while (!this.isIdle() && performance.now() - t < maxMs) { this.checkWorkers(); this.updateChunks(999); this.pump(999); await new Promise((r) => setTimeout(r, 10)) } return this.isIdle() }
  // the player is held in place until the chunk under them is meshed (visible); collisions always use block data
  groundReady() { const e = this.meshes.get(ckey(Math.floor(this.player.pos.x / CS), Math.floor(this.player.pos.z / CS))); return !!(e && e.built) }
  isIdle() { return !this.queue.length && !this.inflight && !this.pendingChunks && [...this.meshes.values()].every((e) => e.built) }
  // ---------- world lifecycle ----------
  setupWorld(seed, village = false) {
    this.ready = false; this.waitT = 0
    this.clearMeshes(); for (const m of this.mobs) m.dispose(this.scene); this.mobs = []
    if (this.decor) { this.scene.remove(this.decor.root); this.decor = null }
    this.world = new World(seed); this.world.onChange = (x, y, z, w) => this.dirty(x, y, z, w)
    this.chests = {}
    if (village) { const v = this.world.enableVillage(); this.decor = buildDecor(v.decor); this.scene.add(this.decor.root) }
  }
  // Pekaville is on for every new world (tests can pass { village: false } or set villageDefault = false)
  newWorld(seed = (Math.random() * 1e9) | 0, opts = {}) {
    const village = opts.village ?? this.villageDefault ?? true
    this.setupWorld(seed, village)
    this.inv = { [PLANKS]: 32, [GLASS]: 16, [BRICK]: 16, [TORCH]: 8, [BUCKET]: 1 }; this.sel = 2; this.hotbar = HOTBAR2.slice(); this.time = 0.3
    this.hp = MAXHP; this.dead = false
    if (village) this.fillStarterChest()
    this.spawn(); this.spawnPoint = this.player.pos.clone(); this.save(); this.emit()
  }
  fillStarterChest() { const v = this.world.village; if (v) this.chests[v.chest.join(',')] = { ...STARTER_CHEST } }
  // ---------- chests ----------
  chestAt(x, y, z) { const k = x + ',' + y + ',' + z; return this.chests[k] || (this.chests[k] = {}) }
  chestTake(key, id, n = Infinity) {
    const c = this.chests[key]; if (!c || !(c[id] > 0)) return 0
    const k = Math.min(n, c[id]); c[id] -= k; if (!c[id]) delete c[id]; this.give(id, k)
    if (!this.hotbar.includes(id)) { const e = this.hotbar.findIndex((h) => !(this.inv[h] > 0)); if (e >= 0) this.hotbar[e] = id }
    this.emit(); return k
  }
  chestTakeAll(key) { const c = this.chests[key] || {}; let n = 0; for (const id of Object.keys(c).map(Number)) n += this.chestTake(key, id); return n }
  chestPut(key, id, n = Infinity) {
    if (!(this.inv[id] > 0)) return 0
    const k = Math.min(n, this.inv[id]); this.inv[id] -= k; const c = this.chests[key] || (this.chests[key] = {}); c[id] = (c[id] || 0) + k; this.emit(); return k
  }
  armorPoints() { let p = 0; for (const id in this.inv) if (this.inv[id] > 0 && ITEMS[id]?.armor) p += ITEMS[id].armor; return p }
  spawn() {
    const w = this.world
    if (w.village) { const [x, y, z] = w.village.spawn; this.player.pos.set(x, y, z); this.player.vel.set(0, 0, 0); this.player.yaw = 0; this.player.pitch = -0.05; this.fallTop = null; return }
    for (let r = 0; r < 200; r++) {
      const x = Math.floor(Math.cos(r) * r * 2) + 8, z = Math.floor(Math.sin(r) * r * 2) + 8
      const s = w.surface(x, z)
      if (s.b !== WATER && s.b !== LEAVES) { this.player.pos.set(x + 0.5, s.y + 1, z + 0.5); break }
    }
    this.player.vel.set(0, 0, 0); this.player.yaw = 0; this.player.pitch = -0.2; this.fallTop = null
  }
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!s || (s.v !== 1 && s.v !== 2)) return false
      // Pekaville in old saves: only if the starting area was never touched (no saved changes in its chunks)
      const mods = s.mods || {}, untouched = VILLAGE_CHUNKS.every((k) => !mods[k] || !mods[k].length)
      const village = s.village === true || (s.village === undefined && untouched)
      this.setupWorld(s.seed, village); this.world.loadMods(mods)
      this.chests = s.chests || {}
      this.villageAdded = village && s.village === undefined
      if (this.villageAdded) this.fillStarterChest()
      this.inv = s.inv || {}; this.sel = s.sel || 0; this.time = s.time ?? 0.3
      this.hotbar = Array.isArray(s.hotbar) ? s.hotbar : HOTBAR.slice() // v1 saves used the fixed v1 hotbar
      this.hp = s.hp ?? MAXHP; this.dead = false; if (this.hp <= 0) this.hp = MAXHP
      const p = s.player; this.player.pos.set(p.x, p.y, p.z); this.player.yaw = p.yaw; this.player.pitch = p.pitch; this.player.vel.set(0, 0, 0)
      this.spawnPoint = s.spawn ? new THREE.Vector3(...s.spawn) : this.player.pos.clone()
      if (this.villageAdded) { this.spawnPoint = new THREE.Vector3(...this.world.village.spawn); this.player.pos.copy(this.spawnPoint); this.player.yaw = 0; this.player.pitch = -0.05 } // the old spot may now be inside the house
      this.fallTop = null; this.emit(); return true
    } catch { return false }
  }
  hasSave() { return !!localStorage.getItem(SAVE_KEY) }
  save() {
    if (!this.world) return
    const p = this.player.pos
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, seed: this.world.seed, mods: this.world.serializeMods(), inv: this.inv, sel: this.sel, hotbar: this.hotbar, time: this.time, hp: this.hp, village: !!this.world.village, chests: this.chests,
      spawn: this.spawnPoint ? this.spawnPoint.toArray() : null, player: { x: p.x, y: p.y, z: p.z, yaw: this.player.yaw, pitch: this.player.pitch } }))
  }
  // ---------- chunk meshes ----------
  clearMeshes() { for (const m of this.meshes.values()) this.disposeEntry(m); this.meshes.clear(); this.queue = [] }
  disposeEntry(e) { for (const k of ['solid', 'water']) if (e[k]) { this.scene.remove(e[k]); e[k].geometry.dispose(); e[k] = null } }
  dirty(x, y, z, fromWater) {
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS)
    if (fromWater) { // water: batched, only the chunk(s) touching the cell
      const lx = x - cx * CS, lz = z - cz * CS
      this.waterDirty.add(ckey(cx, cz))
      if (lx === 0) this.waterDirty.add(ckey(cx - 1, cz)); if (lx === CS - 1) this.waterDirty.add(ckey(cx + 1, cz))
      if (lz === 0) this.waterDirty.add(ckey(cx, cz - 1)); if (lz === CS - 1) this.waterDirty.add(ckey(cx, cz + 1))
      return
    }
    // light can change up to 15 blocks away: own chunk first, then neighbours in reach
    this.schedule(cx, cz, true)
    for (let X = Math.floor((x - 15) / CS); X <= Math.floor((x + 15) / CS); X++) for (let Z = Math.floor((z - 15) / CS); Z <= Math.floor((z + 15) / CS); Z++) if (X !== cx || Z !== cz) this.schedule(X, Z)
    this.pump()
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
    const room = Math.max(0, budget - this.queue.length)
    for (let i = 0; i < Math.min(room, want.length); i++) { const [, cx, cz] = want[i]; this.meshes.set(ckey(cx, cz), { cx, cz }); this.schedule(cx, cz) }
    this.pendingChunks = Math.max(0, want.length - room)
    this.checkWorkers(); this.pump()
    const far = r * CS
    for (const m of [this.matSolid, this.matWater]) { m.uniforms.fogNear.value = far * 0.55; m.uniforms.fogFar.value = far * 0.95 }
  }
  lightAt(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z)
    if (y >= CH) return { sky: 15, blk: 0 }; if (y < 0) return { sky: 0, blk: 0 }
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS), e = this.meshes.get(ckey(cx, cz))
    if (!e || !e.light) return { sky: 15, blk: 0 }
    const v = e.light[(y * CS + (z - cz * CS)) * CS + (x - cx * CS)]; return { sky: v >> 4, blk: v & 15 }
  }
  lightAtBody(x, y, z) { const l = this.lightAt(x, y, z); return Math.max(Math.pow(0.8, 15 - l.sky) * (this.daylight() + this.moonlight()), l.blk ? Math.pow(0.8, 15 - l.blk) : 0, 0.05) }
  // ---------- physics ----------
  solidAt(x, y, z) { return boxHits(this.world, { x: x + 0.5, y, z: z + 0.5 }, 0.1, 0.1) }
  boxHits(p) { return boxHits(this.world, p, W, HGT) }
  physics(dt) {
    const pl = this.player, inp = this.dead ? { mx: 0, mz: 0, jump: false } : this.input
    const feet = this.world.get(Math.floor(pl.pos.x), Math.floor(pl.pos.y + 0.4), Math.floor(pl.pos.z))
    pl.inWater = feet === WATER
    const sp = pl.inWater ? 2.2 : 4.3
    const len = Math.hypot(inp.mx, inp.mz) || 1, k = Math.min(1, len) / len
    const sx = inp.mx * k, sz = inp.mz * k, s = Math.sin(pl.yaw), c = Math.cos(pl.yaw)
    const vx = (sx * c - sz * s) * sp, vz = (-sx * s - sz * c) * sp
    const kb = this.knock || 0; this.knock = Math.max(0, kb - dt)
    pl.vel.x = kb > 0 ? pl.vel.x * 0.9 : vx; pl.vel.z = kb > 0 ? pl.vel.z * 0.9 : vz
    // swimming: water is never solid; holding jump swims up steadily, a short "wet" window after the feet
    // leave the surface lets you keep rising and climb a 1-block shore (Minecraft-like water exit)
    const wb = this.world.get(Math.floor(pl.pos.x), Math.floor(pl.pos.y + 0.05), Math.floor(pl.pos.z)) === WATER
    if (pl.inWater || wb) pl.wetT = 0.35; else pl.wetT = Math.max(0, (pl.wetT || 0) - dt)
    if (pl.inWater) { pl.vel.y -= 9 * dt; if (inp.jump) pl.vel.y = pl.onGround ? 6 : Math.max(pl.vel.y, 4); pl.vel.y = Math.max(pl.vel.y, -3) }
    else {
      pl.vel.y -= 28 * dt
      if (inp.jump && pl.onGround) pl.vel.y = 8.6
      else if (inp.jump && pl.wetT > 0 && pl.vel.y < 4) pl.vel.y = 4 // still bobbing at the surface: keep swimming up
      pl.vel.y = Math.max(pl.vel.y, -40)
    }
    const hitWall = moveBody(this.world, pl, dt)
    // at the surface pushing into a shore wall while holding jump: boost up so the step can be cleared
    if (hitWall && inp.jump && pl.wetT > 0 && !pl.onGround && pl.vel.y < 7.6) pl.vel.y = 7.6
    // fall damage
    if (pl.onGround || pl.inWater) {
      if (this.fallTop != null && pl.onGround && !pl.inWater) { const d = this.fallTop - pl.pos.y; if (d > 3.5) this.damage(Math.floor(d - 3), null, 'caída') }
      this.fallTop = null
    } else this.fallTop = this.fallTop == null ? pl.pos.y : Math.max(this.fallTop, pl.pos.y)
    if (pl.pos.y < -20) { this.spawn() }
    const moving = pl.onGround && (Math.abs(vx) + Math.abs(vz) > 0.1)
    if (moving) { this.bob += dt * 9; this.stepAcc += Math.hypot(vx, vz) * dt; if (this.stepAcc > 2.2) { this.stepAcc = 0; const b = this.world.get(Math.floor(pl.pos.x), Math.floor(pl.pos.y - 0.1), Math.floor(pl.pos.z)); if (BLOCKS[b]) this.sfx.step(BLOCKS[b].sound) } }
    else this.bob *= 0.9
  }
  // ---------- health ----------
  damage(n, from, why) {
    if (this.dead || this.noDamage || n <= 0) return
    const ap = this.armorPoints(); if (ap && why !== 'caída') n = Math.max(1, Math.round(n * (1 - Math.min(0.6, ap * 0.04)))) // armour carried in the inventory protects from hits
    this.hp = Math.max(0, this.hp - n); this.lastHurt = this.clock; this.hurtFlash = 0.35; this.sfx.hurt?.()
    if (from) { const d = this.player.pos.clone().sub(from).setY(0).normalize(); this.player.vel.x = d.x * 7; this.player.vel.z = d.z * 7; this.player.vel.y = 5; this.knock = 0.25 }
    if (this.hp <= 0) { this.dead = true; this.deathCause = why || 'golpe'; this.input.breaking = false }
    this.emit()
  }
  respawn() {
    this.hp = MAXHP; this.dead = false; this.player.vel.set(0, 0, 0)
    if (this.spawnPoint) { this.player.pos.copy(this.spawnPoint); const s = this.world.surface(Math.floor(this.spawnPoint.x), Math.floor(this.spawnPoint.z)); this.player.pos.y = Math.max(this.player.pos.y, s.y + 1) } else this.spawn()
    this.fallTop = null; this.emit()
  }
  // ---------- interaction ----------
  dir() { const p = this.player; return new THREE.Vector3(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)) }
  eye() { return this.player.pos.clone().add(new THREE.Vector3(0, EYE, 0)) }
  raycast(water = false) {
    const o = this.eye(), d = this.dir()
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z)
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z)
    const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z)
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz
    let n = [0, 0, 0], t = 0
    while (t <= REACH) {
      const id = this.world.get(x, y, z)
      if (id !== AIR && (id !== WATER || (water && this.world.meta(x, y, z) === 0))) return { x, y, z, n, id, t }
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0] }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0] }
      else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz] }
    }
    return null
  }
  targetMob() {
    const o = this.eye(), d = this.dir(); let best = null, bt = 4
    for (const m of this.mobs) { const t = rayBox(o, d, m, bt); if (t >= 0 && t < bt) { bt = t; best = m } }
    if (!best) return null
    const h = this.raycast(); if (h && h.t < bt) return null
    return best
  }
  selected() { return this.hotbar[this.sel] }
  give(id, n = 1) { this.inv[id] = (this.inv[id] || 0) + n }
  // "Poner/usar": place a block, use the bucket, or eat
  place() {
    if (this.dead) return false
    const id = this.selected()
    if (!(this.inv[id] > 0)) { this.toast?.('No te quedan: ' + itemName(id).toLowerCase()); return false }
    if (ITEMS[id]?.food) {
      if (this.hp >= this.maxHp) { this.toast?.('Tienes la vida llena'); return false }
      this.hp = Math.min(this.maxHp, this.hp + ITEMS[id].food); this.inv[id]--; this.swing = 1; this.sfx.place('dirt'); this.emit(); return true
    }
    if (id === BUCKET) {
      const h = this.raycast(true); if (!h || h.id !== WATER) return false
      this.world.set(h.x, h.y, h.z, AIR); this.inv[BUCKET]--; this.give(WATER_BUCKET); this.swing = 1; this.sfx.place('sand'); this.emit(); return true
    }
    const h = this.raycast(); if (!h) return false
    if (h.id === TABLE || h.id === FURNACE) { this.openCraft?.(); return false }
    if (h.id === CHEST) { this.chestAt(h.x, h.y, h.z); this.openChest?.(h.x + ',' + h.y + ',' + h.z); this.sfx.place('wood'); return false }
    if (!isBlock(id) && id !== WATER_BUCKET) return false
    const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2]
    const cur = this.world.get(x, y, z); if (cur !== AIR && cur !== WATER) return false
    if (y < 1 || y >= CH) return false
    if (id === WATER_BUCKET) {
      this.world.set(x, y, z, WATER, 0); this.inv[id]--; this.give(BUCKET); this.swing = 1; this.sfx.place('sand'); this.emit(); return true
    }
    const p = this.player.pos
    if (!BLOCKS[id].nonSolid && x + 1 > p.x - W && x < p.x + W && z + 1 > p.z - W && z < p.z + W && y + 1 > p.y && y < p.y + HGT) {
      // jumping onto your own pillar: remember the tap and place as soon as the feet clear the cell
      if ((!this.player.onGround || this.player.inWater) && !this.retrying) this.placeBuf = this.player.inWater ? 1.2 : 0.6
      return false
    }
    for (const m of this.mobs) if (!BLOCKS[id].nonSolid && x + 1 > m.pos.x - m.w && x < m.pos.x + m.w && z + 1 > m.pos.z - m.w && z < m.pos.z + m.w && y + 1 > m.pos.y && y < m.pos.y + m.h) return false
    if (id === TORCH && !this.solidBelowOrSide(x, y, z)) return false
    this.world.set(x, y, z, id); this.inv[id]--; this.swing = 1; this.sfx.place(BLOCKS[id].sound); this.emit(); return true
  }
  solidBelowOrSide(x, y, z) { return BLOCKS[this.world.get(x, y - 1, z)] && this.world.get(x, y - 1, z) !== WATER }
  updateBreak(dt) {
    this.attackCd -= dt
    if (this.input.breaking && !this.dead) {
      const m = this.targetMob()
      if (m) { this.brk.key = null; this.crack.visible = false; if (this.attackCd <= 0) { const sw = this.inv[this.selected()] > 0 && ITEMS[this.selected()]?.dmg; this.attackCd = 0.45; this.swing = 1; m.hit(sw || 4, this.player.pos); this.sfx.dig('wood') } return }
    }
    const h = this.input.breaking && !this.dead ? this.raycast() : null
    if (!h || BLOCKS[h.id].hard === Infinity) { this.brk.key = null; this.brk.t = 0; this.crack.visible = false; return }
    const key = h.x + ',' + h.y + ',' + h.z
    if (key !== this.brk.key) { this.brk.key = key; this.brk.t = 0 }
    const tl = this.inv[this.selected()] > 0 && ITEMS[this.selected()]?.tool
    this.brk.t += dt * (tl && TOOL_SOUNDS[tl].includes(BLOCKS[h.id].sound) ? ITEMS[this.selected()].speed : 1); this.swing = Math.max(this.swing, 0.01)
    const f = this.brk.t / BLOCKS[h.id].hard
    if (((this.brk.t * 5) | 0) !== (((this.brk.t - dt) * 5) | 0)) this.sfx.dig(BLOCKS[h.id].sound)
    if (f >= 1) {
      if (h.id === CHEST) { const k = h.x + ',' + h.y + ',' + h.z, c = this.chests[k]; if (c) { for (const id in c) this.give(+id, c[id]); delete this.chests[k] } } // contents spill into the inventory
      this.world.set(h.x, h.y, h.z, AIR); this.give(BLOCKS[h.id].drop || h.id)
      if (h.id === LEAVES && Math.random() < 0.15) this.give(STICK)
      this.sfx.brk(BLOCKS[h.id].sound); this.brk.key = null; this.brk.t = 0; this.crack.visible = false; this.emit(); return
    }
    this.crack.visible = true; this.crack.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5)
    this.crack.material.map = this.cracks[Math.min(5, Math.floor(f * 6))]
  }
  // ---------- crafting ----------
  nearBlock(id, r = 4) {
    const p = this.player.pos
    for (let y = Math.floor(p.y) - 2; y <= Math.floor(p.y) + 3; y++) for (let z = Math.floor(p.z) - r; z <= Math.floor(p.z) + r; z++) for (let x = Math.floor(p.x) - r; x <= Math.floor(p.x) + r; x++) if (this.world.get(x, y, z) === id) return true
    return false
  }
  craftState(rec) {
    const needOK = !rec.need || this.nearBlock(rec.need === 'mesa' ? TABLE : FURNACE)
    const missing = rec.inp.filter(([id, n]) => (this.inv[id] || 0) < n)
    return { ok: needOK && !missing.length, needOK, missing, needName: rec.need ? NEED_NAME[rec.need] : null }
  }
  craft(rid, times = 1) {
    const rec = RECIPES.find((r) => r.id === rid); if (!rec) return 0
    let done = 0
    for (let i = 0; i < times; i++) {
      if (!this.craftState(rec).ok) break
      for (const [id, n] of rec.inp) this.inv[id] -= n
      this.give(rec.out[0], rec.out[1]); done++
    }
    if (done) { this.sfx.place('wood'); this.emit() }
    return done
  }
  // ---------- mobs ----------
  spawnMob(type, x, y, z) { const m = new Mob(type, x, y, z, this.scene); this.mobs.push(m); return m }
  updateMobs(dt) {
    const L = this.daylight(), P = this.player.pos
    this.spawnT -= dt
    if (this.mobsEnabled && this.spawnT <= 0) {
      this.spawnT = 1.5
      const cap = this.quality >= 2 ? 0.5 : 1
      const pom = this.mobs.filter((m) => m.type === 'pompon').length, som = this.mobs.length - pom
      const tryType = L < 0.35 && som < 4 * cap ? 'sombrajo' : pom < 5 * cap ? 'pompon' : null
      if (tryType) {
        const a = Math.random() * 6.28, d = 14 + Math.random() * 16, x = Math.floor(P.x + Math.cos(a) * d), z = Math.floor(P.z + Math.sin(a) * d)
        const s = this.world.surface(x, z), l = this.lightAt(x, s.y + 1, z)
        const ok = tryType === 'pompon' ? s.b === 1 : (s.b !== WATER && s.b !== LEAVES && l.blk < 6)
        if (ok && this.meshes.get(ckey(Math.floor(x / CS), Math.floor(z / CS)))?.light) this.spawnMob(tryType, x + 0.5, s.y + 1, z + 0.5)
      }
    }
    for (const m of this.mobs) {
      m.update(dt, this)
      if (m.type === 'sombrajo' && L > 0.6 && this.lightAt(m.pos.x, m.pos.y + 1, m.pos.z).sky >= 12) { m.burn = (m.burn || 0) + dt; if (m.burn > 1) { m.burn = 0; m.hp -= 4; m.hurt = 0.3; if (m.hp <= 0) m.dead = true } }
      if (m.pos.distanceTo(P) > 64) { m.dead = true; m.gone = true }
    }
    for (const m of this.mobs) if (m.dead) {
      if (!m.gone && m.hp <= 0) { const [id, a, b] = m.T.drop; this.give(id, a + Math.floor(Math.random() * (b - a + 1))); this.sfx.brk('grass'); this.emit() }
      m.dispose(this.scene)
    }
    this.mobs = this.mobs.filter((m) => !m.dead)
  }
  // ---------- visuals ----------
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
    this.armMat = new THREE.MeshBasicMaterial({ map: skin }); this.sleeveMat = new THREE.MeshBasicMaterial({ map: sleeve })
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.7), this.armMat)
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.19, 0.28), this.sleeveMat); cuff.position.z = 0.3
    this.hand.add(arm, cuff)
    const ht = this.atlas.tex.clone(); ht.colorSpace = THREE.SRGBColorSpace; ht.needsUpdate = true
    this.held = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.21, 0.21), new THREE.MeshBasicMaterial({ map: ht, alphaTest: 0.5 }))
    this.held.position.set(-0.04, 0.17, -0.34)
    this.heldItem = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }))
    this.heldItem.position.set(-0.05, 0.2, -0.36); this.heldItem.rotation.set(0, 0.9, 0)
    this.itemTex = {}
    this.hand.add(this.held, this.heldItem)
    this.hand.position.set(0.42, -0.42, -0.6); this.hand.rotation.set(0.15, 0.25, 0)
    this.handScene.add(this.hand)
  }
  setHeldUV(id) {
    this.heldId = id
    if (!isBlock(id)) {
      if (!this.itemTex[id]) { const t = new THREE.CanvasTexture(itemCanvas(id)); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; this.itemTex[id] = t }
      this.heldItem.material.map = this.itemTex[id]; this.heldItem.material.needsUpdate = true; return
    }
    const g = this.held.geometry, uv = g.attributes.uv, B = BLOCKS[id]
    const slot = [1, 1, 0, 2, 1, 1]
    for (let f = 0; f < 6; f++) { const t = B.tiles[slot[f]]; for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setX(i, (t + (k % 2)) / NT) } }
    uv.needsUpdate = true
  }
  updateHand(dt) {
    const id = this.selected(), has = this.inv[id] > 0
    this.held.visible = has && isBlock(id); this.heldItem.visible = has && !isBlock(id)
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
    this.clock += dt
    if (!this.ready) { this.waitT = (this.waitT || 0) + dt; if (this.groundReady() || this.waitT > 6) { this.ready = true; this.fallTop = null } }
    if (this.ready) this.physics(dt)
    this.updateBreak(dt)
    if (this.placeBuf > 0) { this.placeBuf -= dt; this.retrying = true; if (this.place()) this.placeBuf = 0; this.retrying = false; if (this.player.onGround && !this.player.inWater && this.player.vel.y <= 0) this.placeBuf = 0 }
    this.time = (this.time + dt / DAY) % 1
    this.waterT -= dt
    if (this.waterT <= 0) { // throttled cellular water + batched remeshing
      this.waterT = 0.25; this.world.waterStep(this.quality >= 2 ? 48 : 96)
      for (const k of this.waterDirty) { const [cx, cz] = k.split(',').map(Number); this.schedule(cx, cz) }
      this.waterDirty.clear()
    }
    this.updateMobs(dt)
    if (!this.dead && this.hp < this.maxHp && this.clock - this.lastHurt > 5) { this.regenT += dt; if (this.regenT > 3) { this.regenT = 0; this.hp++; this.emit() } }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt)
    this.updateChunks()
    this.updateHand(dt)
  }
  advance(sec, fps = 60) { const n = Math.round(sec * fps); for (let i = 0; i < n; i++) this.update(1 / fps) }
  trackPerf(raw) {
    if (!this.autoQuality || this.quality >= 2) return
    this.ft.push(raw); if (this.ft.length < 150) return
    const avg = this.ft.reduce((a, b) => a + b, 0) / this.ft.length; this.ft = []
    if (avg > 1 / 30) this.setQuality(this.quality + 1, true)
  }
  setQuality(q, auto) {
    this.quality = q
    this.renderer.setPixelRatio(this.basePR * [1, 0.75, 0.6][q])
    if (q >= 1) this.viewDist = Math.max(2, Math.min(this.viewDist, q === 1 ? 3 : 2))
    this.resize(); if (auto) this.toast?.('Calidad reducida para ir más fluido'); this.emit()
  }
  moonlight() { return 0.34 * Math.max(0, Math.min(1, (0.6 - this.daylight()) / 0.5)) }
  // ---------- sky: blocky sun + moon on an orbit around the camera, stars at night (all procedural) ----------
  initSky() {
    const tex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t }
    const sunT = tex((g) => { g.fillStyle = '#fff6b0'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#ffe14d'; g.fillRect(2, 2, 12, 12); g.fillStyle = '#fffbe0'; g.fillRect(4, 4, 8, 8) })
    const moonT = tex((g) => { g.fillStyle = '#d8deea'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#aab3c6'; for (const [x, y, w] of [[3, 3, 3], [9, 5, 4], [5, 10, 3], [11, 11, 2]]) g.fillRect(x, y, w, w) })
    const mk = (t, size) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, fog: false, depthWrite: false, depthTest: false })); m.renderOrder = -10; m.frustumCulled = false; return m } // opaque + drawn first: terrain covers it
    this.sky = new THREE.Group(); this.sun = mk(sunT, 34); this.moon = mk(moonT, 24); this.sky.add(this.sun, this.moon)
    const n = this.mobile ? 160 : 320, pos = new Float32Array(n * 3); let r = 12345
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u); pos.set([q * Math.cos(a) * 180, Math.abs(u) * 180 + 10, q * Math.sin(a) * 180], i * 3) }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: this.mobile ? 2 : 1.6, sizeAttenuation: false, fog: false, depthWrite: false, depthTest: false }))
    this.stars.renderOrder = -11; this.stars.frustumCulled = false; this.sky.add(this.stars)
    this.scene.add(this.sky)
  }
  updateSky(L) {
    if (!this.sky) this.initSky()
    this.sky.position.copy(this.camera.position)
    const a = (this.time - 0.25) * Math.PI * 2, R = 160 // time 0.25 = noon (sun overhead), 0.75 = midnight
    this.sun.position.set(Math.sin(a) * R, Math.cos(a) * R, 0); this.moon.position.set(-Math.sin(a) * R, -Math.cos(a) * R, 0)
    this.sun.lookAt(this.sky.position); this.moon.lookAt(this.sky.position)
    this.sun.visible = this.sun.position.y > -20; this.moon.visible = this.moon.position.y > -20
    this.stars.rotation.z = a; const so = Math.max(0, Math.min(1, (0.45 - L) / 0.35)); this.stars.material.color.setScalar(so); this.stars.visible = so > 0.01
  }
  daylight() { return Math.min(1, Math.max(0.06, 0.5 + 0.8 * Math.sin((this.time - 0.25) * Math.PI * 2 + Math.PI / 2))) }
  render() {
    const p = this.player, c = this.camera
    c.position.copy(p.pos); c.position.y += EYE + (p.onGround ? Math.abs(Math.sin(this.bob)) * 0.05 : 0)
    c.rotation.set(p.pitch, p.yaw, 0)
    const L = this.daylight()
    const sky = SKY_NIGHT.clone().lerp(SKY_DAY, (L - 0.06) / 0.94)
    const fog = sky.clone().convertLinearToSRGB()
    for (const m of [this.matSolid, this.matWater]) { m.uniforms.daylight.value = L; m.uniforms.moon.value = this.moonlight(); m.uniforms.fogColor.value.copy(fog) }
    this.renderer.setClearColor(sky)
    this.updateSky(L)
    if (this.decor) for (const m of this.decor.items) { const q = m.position, r = m.rotation.y, l = this.lightAtBody(q.x + Math.sin(r) * 0.4, q.y + 0.5, q.z + Math.cos(r) * 0.4); m.traverse((o) => o.material && o.material.color && o.material.color.setScalar(l)) }
    const e = this.eye(), hb = this.lightAtBody(e.x, e.y, e.z)
    this.armMat.color.setScalar(hb); this.sleeveMat.color.setScalar(hb); this.held.material.color.setScalar(Math.max(0.3, hb)); this.heldItem.material.color.setScalar(Math.max(0.3, hb))
    const h = this.running ? this.raycast() : null
    this.hl.visible = !!h; if (h) this.hl.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5)
    this.renderer.clear(); this.renderer.render(this.scene, c)
    this.renderer.clearDepth(); this.renderer.render(this.handScene, this.handCam)
  }
  resize() {
    const w = innerWidth, h = innerHeight
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix()
    if (this.handCam) { this.handCam.aspect = w / h; this.handCam.updateProjectionMatrix() }
  }
}
