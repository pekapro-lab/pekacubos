import './style.css'
import { Game } from './game.js'
import { BLOCKS, HOTBAR } from './blocks.js'
import { iconURL } from './textures.js'

const $ = (s) => document.querySelector(s)
const game = new Game($('#c'))
window.__PEKACUBOS__ = game
const SET_KEY = 'pekacubos.settings.v1'
const settings = Object.assign({ dist: matchMedia('(pointer: coarse)').matches ? 3 : 5, vol: 70 }, JSON.parse(localStorage.getItem(SET_KEY) || '{}'))
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
document.body.classList.toggle('touch', touch)
$('#ver').textContent = 'v' + __PEKACUBOS_VERSION__

// ---------- HUD ----------
const hot = $('#hotbar')
HOTBAR.forEach((id, i) => {
  const d = document.createElement('div'); d.className = 'slot'; d.dataset.i = i
  d.innerHTML = `<img src="${iconURL(game.atlas.canvas, BLOCKS[id].tiles[1])}"><span></span>`
  d.addEventListener('pointerdown', (e) => { e.stopPropagation(); game.sel = i; game.emit() })
  hot.appendChild(d)
})
let toastT
game.toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600) }
game.listeners.add(() => {
  hot.querySelectorAll('.slot').forEach((d, i) => { d.classList.toggle('sel', i === game.sel); const n = game.inv[HOTBAR[i]] || 0; d.querySelector('span').textContent = n; d.classList.toggle('empty', !n) })
  $('#bname').textContent = BLOCKS[HOTBAR[game.sel]].name
})

// ---------- menu ----------
function applySettings() {
  game.viewDist = +settings.dist; game.sfx.setVolume(settings.vol / 100)
  $('#dist').value = settings.dist; $('#distv').textContent = settings.dist; $('#vol').value = settings.vol; $('#volv').textContent = settings.vol + '%'
  localStorage.setItem(SET_KEY, JSON.stringify(settings))
}
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
  if (!game.running) return
  keys.add(e.code); keyMove()
  if (/^Digit[1-9]$/.test(e.code)) { game.sel = +e.code[5] - 1; game.emit() }
  if (e.code === 'Space') e.preventDefault()
})
addEventListener('keyup', (e) => { keys.delete(e.code); keyMove() })
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && game.running && !touch) showMenu() })
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
hold($('#bplace'), () => game.place(), () => {})

// Start on the menu
showMenu()
if (new URLSearchParams(location.search).has('autoplay')) play()
