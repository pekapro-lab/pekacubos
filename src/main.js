import './style.css'
import { Game } from './game.js'
import { BLOCKS, isBlock, itemName } from './blocks.js'
import { iconURL, itemCanvas, heartCanvas } from './textures.js'
import { RECIPES } from './crafting.js'

const $ = (s) => document.querySelector(s)
const game = new Game($('#c'))
window.__PEKACUBOS__ = game
const SET_KEY = 'pekacubos.settings.v1'
const settings = Object.assign({ dist: matchMedia('(pointer: coarse)').matches ? 3 : 5, vol: 70, auto: true }, JSON.parse(localStorage.getItem(SET_KEY) || '{}'))
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
document.body.classList.toggle('touch', touch)
$('#ver').textContent = 'v' + __PEKACUBOS_VERSION__

// ---------- HUD ----------
const hot = $('#hotbar')
const icons = {}
const icon = (id) => icons[id] || (icons[id] = isBlock(id) ? iconURL(game.atlas.canvas, BLOCKS[id].tiles[1]) : (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(itemCanvas(id), 0, 0, 32, 32); return c.toDataURL() })())
for (let i = 0; i < 9; i++) {
  const d = document.createElement('div'); d.className = 'slot'; d.dataset.i = i
  d.innerHTML = `<img><span></span>`
  d.addEventListener('pointerdown', (e) => { e.stopPropagation(); game.sel = i; game.emit() })
  hot.appendChild(d)
}
const hearts = [0, 1, 2].map((k) => heartCanvas(k).toDataURL())
const hpEl = $('#hp'); for (let i = 0; i < 10; i++) hpEl.appendChild(document.createElement('img'))
let toastT
game.toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600) }
let hurtT
game.listeners.add(() => {
  if (game.hurtFlash > 0.3) { $('#hurt').classList.add('on'); clearTimeout(hurtT); hurtT = setTimeout(() => $('#hurt').classList.remove('on'), 120) }
  hot.querySelectorAll('.slot').forEach((d, i) => { const id = game.hotbar[i]; d.classList.toggle('sel', i === game.sel); const n = game.inv[id] || 0; const im = d.querySelector('img'); const u = icon(id); if (im.getAttribute('src') !== u) im.src = u; d.querySelector('span').textContent = n; d.classList.toggle('empty', !n) })
  $('#bname').textContent = itemName(game.selected())
  hpEl.querySelectorAll('img').forEach((im, i) => { const v = game.hp - i * 2; const u = hearts[v >= 2 ? 2 : v === 1 ? 1 : 0]; if (im.getAttribute('src') !== u) im.src = u })
  $('#dead').classList.toggle('hidden', !game.dead); if (game.dead) $('#deadwhy').textContent = game.deathCause === 'caída' ? 'Te has caído desde muy alto.' : 'Te ha alcanzado un Sombrajo.'
  if (!$('#craft').classList.contains('hidden')) renderCraft()
})

// ---------- menu ----------
function applySettings() {
  game.viewDist = +settings.dist; game.sfx.setVolume(settings.vol / 100); game.autoQuality = settings.auto; $('#auto').checked = settings.auto
  $('#dist').value = settings.dist; $('#distv').textContent = settings.dist; $('#vol').value = settings.vol; $('#volv').textContent = settings.vol + '%'
  localStorage.setItem(SET_KEY, JSON.stringify(settings))
}
$('#auto').onchange = (e) => { settings.auto = e.target.checked; applySettings() }
$('#dist').oninput = (e) => { settings.dist = +e.target.value; applySettings() }
$('#vol').oninput = (e) => { settings.vol = +e.target.value; applySettings() }
applySettings()
function showMenu() {
  game.running = false; game.input.breaking = false; game.input.mx = game.input.mz = 0; game.save()
  $('#play').textContent = game.world ? 'Continuar' : (game.hasSave() ? 'Jugar' : 'Jugar (mundo nuevo)')
  $('#menu').classList.remove('hidden'); $('#hud').classList.add('hidden')
  if (document.pointerLockElement) document.exitPointerLock()
}
function play() {
  game.sfx.unlock()
  if (!game.world && !game.load()) game.newWorld()
  game.updateChunks(999)
  $('#menu').classList.add('hidden'); $('#hud').classList.remove('hidden'); game.running = true; game.emit()
  if (!touch) game.canvas.requestPointerLock?.()
}
$('#play').onclick = play
$('#new').onclick = () => {
  if (game.hasSave() && !confirm('¿Crear un mundo nuevo? Se sustituirá el mundo guardado.')) return
  game.newWorld(); play()
}
$('#pause').addEventListener('pointerdown', (e) => { e.stopPropagation(); showMenu() })
game.showMenu = showMenu; game.play = play
$('#respawn').addEventListener('click', () => { game.respawn() })
// ---------- inventory + crafting ----------
let pickFor = null
function renderCraft() {
  const inv = $('#invgrid'); inv.innerHTML = ''
  const ids = Object.keys(game.inv).map(Number).filter((id) => game.inv[id] > 0).sort((a, b) => a - b)
  if (!ids.length) inv.innerHTML = '<div class="muted">Inventario vacío</div>'
  for (const id of ids) {
    const b = document.createElement('button'); b.className = 'it'; b.title = itemName(id)
    b.innerHTML = `<img src="${icon(id)}"><span>${game.inv[id]}</span><small>${itemName(id)}</small>`
    b.onclick = () => { game.hotbar[game.sel] = id; game.emit(); game.toast(itemName(id) + ' → hueco ' + (game.sel + 1)) }
    inv.appendChild(b)
  }
  const rl = $('#recipes'); rl.innerHTML = ''
  for (const r of RECIPES) {
    const st = game.craftState(r)
    const row = document.createElement('div'); row.className = 'rec' + (st.ok ? '' : ' no'); row.dataset.id = r.id
    const ing = r.inp.map(([id, n]) => `<span class="${(game.inv[id] || 0) >= n ? '' : 'miss'}"><img src="${icon(id)}">${n}</span>`).join(' + ')
    row.innerHTML = `<div class="rin">${ing} → <img src="${icon(r.out[0])}"><b>${r.out[1]}</b> ${itemName(r.out[0])}</div>` +
      `<div class="rneed">${st.needName ? (st.needOK ? '✔ ' : '✖ Necesitas ') + st.needName + ' cerca' : 'A mano'}</div>`
    const b1 = document.createElement('button'); b1.textContent = 'Fabricar'; b1.disabled = !st.ok; b1.onclick = () => { game.craft(r.id, 1); renderCraft() }
    const b5 = document.createElement('button'); b5.textContent = '×5'; b5.disabled = !st.ok; b5.onclick = () => { game.craft(r.id, 5); renderCraft() }
    row.append(b1, b5); rl.appendChild(row)
  }
}
function openCraft() { game.running = false; game.input.breaking = false; game.input.mx = game.input.mz = 0; renderCraft(); $('#craft').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock() }
function closeCraft() { $('#craft').classList.add('hidden'); game.running = true; if (!touch) game.canvas.requestPointerLock?.() }
game.openCraft = openCraft; game.closeCraft = closeCraft; window.__RECIPES__ = RECIPES
$('#bcraft').addEventListener('pointerdown', (e) => e.stopPropagation()); $('#bcraft').addEventListener('click', (e) => { e.stopPropagation(); openCraft() })
$('#craftclose').onclick = closeCraft

// ---------- chest ----------
const chestEl = document.createElement('div'); chestEl.id = 'chest'; chestEl.className = 'hidden'
chestEl.innerHTML = `<div class="cpanel"><div class="chead"><b>Cofre</b><span><button id="chestall">Coger todo</button> <button id="chestclose">Cerrar ✕</button></span></div>
<div class="ccols"><div><div class="ctitle">En el cofre <small>(toca para coger)</small></div><div id="chestgrid" class="grid"></div></div>
<div><div class="ctitle">Tu inventario <small>(toca para guardar)</small></div><div id="chestinv" class="grid"></div></div></div></div>`
document.body.appendChild(chestEl)
let chestKey = null
function itemsGrid(el, bag, onPick, empty) {
  el.innerHTML = ''
  const ids = Object.keys(bag).map(Number).filter((id) => bag[id] > 0).sort((a, b) => a - b)
  if (!ids.length) el.innerHTML = `<div class="muted">${empty}</div>`
  for (const id of ids) { const b = document.createElement('button'); b.className = 'it'; b.title = itemName(id); b.dataset.id = id
    b.innerHTML = `<img src="${icon(id)}"><span>${bag[id]}</span><small>${itemName(id)}</small>`; b.onclick = () => { onPick(id); renderChest() }; el.appendChild(b) }
}
function renderChest() {
  if (!chestKey) return
  itemsGrid($('#chestgrid'), game.chests[chestKey] || {}, (id) => game.chestTake(chestKey, id), 'El cofre está vacío')
  itemsGrid($('#chestinv'), game.inv, (id) => game.chestPut(chestKey, id), 'Inventario vacío')
}
function openChest(key) { chestKey = key; game.running = false; game.input.breaking = false; game.input.mx = game.input.mz = 0; renderChest(); chestEl.classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock() }
function closeChest() { chestKey = null; chestEl.classList.add('hidden'); game.running = true; game.save(); if (!touch) game.canvas.requestPointerLock?.() }
game.openChest = openChest; game.closeChest = closeChest
$('#chestclose').onclick = closeChest; $('#chestall').onclick = () => { game.chestTakeAll(chestKey); renderChest() }
addEventListener('pagehide', () => game.save())
document.addEventListener('visibilitychange', () => { if (document.hidden) { game.save(); if (game.running) showMenu(); game.sfx.suspend() } })

// ---------- keyboard + mouse ----------
const keys = new Set()
function keyMove() {
  const i = game.input
  i.mz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
  i.mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
  i.jump = keys.has('Space')
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !$('#craft').classList.contains('hidden')) { closeCraft(); return }
  if ((e.code === 'KeyE' || e.code === 'Escape') && chestKey) { closeChest(); return }
  if (!game.running) return
  keys.add(e.code); keyMove()
  if (/^Digit[1-9]$/.test(e.code)) { game.sel = +e.code[5] - 1; game.emit() }
  if (e.code === 'Space') e.preventDefault()
  if (e.code === 'KeyE') openCraft()
})
addEventListener('keyup', (e) => { keys.delete(e.code); keyMove() })
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && game.running && !touch && $('#craft').classList.contains('hidden') && !chestKey) showMenu() })
const look = (dx, dy, k) => { const p = game.player; p.yaw -= dx * k; p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - dy * k)) }
addEventListener('mousemove', (e) => { if (document.pointerLockElement === game.canvas) look(e.movementX, e.movementY, 0.0025) })
game.canvas.addEventListener('mousedown', (e) => {
  if (touch || !game.running) return
  if (!document.pointerLockElement) { game.canvas.requestPointerLock?.(); return }
  if (e.button === 0) game.input.breaking = true; if (e.button === 2) game.place()
})
addEventListener('mouseup', (e) => { if (e.button === 0 && !touch) game.input.breaking = false })
addEventListener('contextmenu', (e) => e.preventDefault())
addEventListener('wheel', (e) => { if (!game.running) return; game.sel = (game.sel + (e.deltaY > 0 ? 1 : 8)) % 9; game.emit() })

// ---------- touch ----------
const joy = $('#joy'), knob = $('#knob')
let joyId = null, joyO = null
const lookers = new Map()
const surface = $('#touch')
surface.addEventListener('pointerdown', (e) => {
  if (!game.running) return
  game.sfx.unlock()
  if (e.clientX < innerWidth * 0.4 && joyId === null) {
    joyId = e.pointerId; joyO = [e.clientX, e.clientY]
    joy.style.left = e.clientX - 60 + 'px'; joy.style.top = e.clientY - 60 + 'px'; joy.classList.add('on'); knob.style.transform = ''
  } else {
    const L = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), drag: false, held: false }
    L.timer = setTimeout(() => { if (!L.drag || Math.hypot(L.x - L.sx, L.y - L.sy) < 24) { L.held = true; game.input.breaking = true } }, 300)
    lookers.set(e.pointerId, L)
  }
  surface.setPointerCapture?.(e.pointerId)
})
surface.addEventListener('pointermove', (e) => {
  if (e.pointerId === joyId) {
    let dx = e.clientX - joyO[0], dy = e.clientY - joyO[1]; const d = Math.hypot(dx, dy), m = 50
    if (d > m) { dx *= m / d; dy *= m / d }
    knob.style.transform = `translate(${dx}px,${dy}px)`
    game.input.mx = dx / m; game.input.mz = -dy / m
    return
  }
  const L = lookers.get(e.pointerId); if (!L) return
  look(e.clientX - L.x, e.clientY - L.y, 0.006); L.x = e.clientX; L.y = e.clientY
  if (Math.hypot(L.x - L.sx, L.y - L.sy) > 12) L.drag = true
})
function endTouch(e) {
  if (e.pointerId === joyId) { joyId = null; joy.classList.remove('on'); game.input.mx = game.input.mz = 0; return }
  const L = lookers.get(e.pointerId); if (!L) return
  clearTimeout(L.timer); lookers.delete(e.pointerId)
  if (L.held) game.input.breaking = [...lookers.values()].some((o) => o.held) || btnBreak
  else if (!L.drag && performance.now() - L.t < 300) game.place()
}
surface.addEventListener('pointerup', endTouch); surface.addEventListener('pointercancel', endTouch)
let btnBreak = false
const hold = (el, on, off) => { el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); game.sfx.unlock(); on() }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off) }
hold($('#bjump'), () => (game.input.jump = true), () => (game.input.jump = false))
hold($('#bbreak'), () => { btnBreak = true; game.input.breaking = true }, () => { btnBreak = false; game.input.breaking = false })
let placeRep
hold($('#bplace'), () => { game.place(); clearInterval(placeRep); placeRep = setInterval(() => game.running && game.place(), 260) }, () => clearInterval(placeRep))

// Start on the menu
showMenu()
if (new URLSearchParams(location.search).has('autoplay')) play()
