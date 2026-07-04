import React, { useMemo } from 'react'
import * as THREE from 'three'

const CanvasLabel3D = ({
  text,
  position = [0, 0, 0],
  scale = [1, 0.35, 1],
  color = '#ffffff',
  background = 'transparent',
  font = '800 72px Arial',
  outline = 'rgba(0,0,0,0.45)'
}) => {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 192
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (background !== 'transparent') {
      ctx.fillStyle = background
      roundRect(ctx, 20, 24, canvas.width - 40, canvas.height - 48, 28)
      ctx.fill()
    }
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 10
    ctx.strokeStyle = outline
    ctx.strokeText(String(text), canvas.width / 2, canvas.height / 2 + 3)
    ctx.fillStyle = color
    ctx.fillText(String(text), canvas.width / 2, canvas.height / 2 + 3)

    const map = new THREE.CanvasTexture(canvas)
    map.anisotropy = 4
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [text, color, background, font, outline])

  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={texture} transparent depthWrite={false} depthTest={false} />
    </sprite>
  )
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export default CanvasLabel3D
