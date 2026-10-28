import { buildChunk } from './mesher.js'
self.onmessage = (e) => {
  const { job, chunks, cx, cz } = e.data
  const r = buildChunk(chunks, cx, cz)
  const tr = [r.light.buffer]
  for (const k of ['solid', 'water']) if (r[k]) tr.push(r[k].p.buffer, r[k].u.buffer, r[k].l.buffer, r[k].i.buffer)
  self.postMessage({ job, cx, cz, ...r }, tr)
}
