// Gera ícones PNG (192, 512, 512 maskable) para o manifest do PWA a partir de formas
// desenhadas em pixel puro (sem dependências externas de imagem).
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

function crc32(buf) {
  let c
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0 // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function makeCanvas(size) {
  const rgba = Buffer.alloc(size * size * 4)
  return {
    size,
    rgba,
    set(x, y, [r, g, b, a]) {
      // x/y quase sempre chegam fracionários (size * 0.12 etc.) — sem arredondar aqui,
      // a escrita cai num índice não-inteiro do Buffer e nunca é aplicada de verdade
      // (ela vira uma propriedade solta no objeto, não um byte real da imagem),
      // deixando o PNG inteiro só com a cor de fundo.
      const xi = Math.round(x)
      const yi = Math.round(y)
      if (xi < 0 || yi < 0 || xi >= size || yi >= size) return
      const i = (yi * size + xi) * 4
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = a
    },
    fillRect(x0, y0, x1, y1, color) {
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(size, Math.ceil(y1)); y++)
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(size, Math.ceil(x1)); x++)
          this.set(x, y, color)
    },
    fillRoundRect(x0, y0, x1, y1, r, color) {
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(size, Math.ceil(y1)); y++) {
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(size, Math.ceil(x1)); x++) {
          const dx = x < x0 + r ? x0 + r - x : x > x1 - r ? x - (x1 - r) : 0
          const dy = y < y0 + r ? y0 + r - y : y > y1 - r ? y - (y1 - r) : 0
          if (dx * dx + dy * dy <= r * r || (dx === 0 && dy === 0) || (dx < r && dy === 0) || (dy < r && dx === 0)) {
            this.set(x, y, color)
          }
        }
      }
    },
  }
}

const BG = [11, 12, 16, 255]
const RED = [255, 77, 79, 255]
const WHITE = [245, 246, 250, 255]

function drawIcon(size, { maskable = false } = {}) {
  const c = makeCanvas(size)
  c.fillRect(0, 0, size, size, BG)

  const pad = maskable ? size * 0.22 : size * 0.12
  const cy = size / 2
  const barH = size * 0.09
  const barY0 = cy - barH / 2
  const barY1 = cy + barH / 2
  const plateW = size * 0.1
  const plateH = size * 0.42

  c.fillRoundRect(pad, barY0, size - pad, barY1, barH / 2, RED)

  const plateY0 = cy - plateH / 2
  const plateY1 = cy + plateH / 2
  c.fillRoundRect(pad, plateY0, pad + plateW, plateY1, plateW * 0.35, WHITE)
  c.fillRoundRect(size - pad - plateW, plateY0, size - pad, plateY1, plateW * 0.35, WHITE)

  const smallW = plateW * 0.55
  const smallH = plateH * 0.6
  const smallY0 = cy - smallH / 2
  const smallY1 = cy + smallH / 2
  c.fillRoundRect(pad - smallW * 0.7, smallY0, pad - smallW * 0.7 + smallW, smallY1, smallW * 0.35, WHITE)
  c.fillRoundRect(
    size - pad + smallW * 0.7 - smallW,
    smallY0,
    size - pad + smallW * 0.7,
    smallY1,
    smallW * 0.35,
    WHITE,
  )

  return c.rgba
}

mkdirSync('public/icons', { recursive: true })

writeFileSync('public/icons/icon-192.png', encodePNG(192, 192, drawIcon(192)))
writeFileSync('public/icons/icon-512.png', encodePNG(512, 512, drawIcon(512)))
writeFileSync(
  'public/icons/icon-512-maskable.png',
  encodePNG(512, 512, drawIcon(512, { maskable: true })),
)

console.log('Ícones gerados em public/icons/')
