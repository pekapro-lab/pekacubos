import { buildChunk } from './mesher.js'
// Plain message protocol; on any failure we answer with { error } so the game falls back to the main thread.
self.onmessage = (e) => {
  const { job, chunks, cx, cz } = e.data
  try {
    const r = buildChunk(chunks, cx, cz)
    const tr = [r.light.buffer]
    for (const k of ['solid', 'water']) if (r[k]) tr.push(r[k].p.buffer, r[k].u.buffer, r[k].l.buffer, r[k].i.buffer)
    self.postMessage({ job, cx, cz, ...r }, tr)
  } catch (err) { self.postMessage({ job, cx, cz, error: String(err && err.message || err) }) }
}
