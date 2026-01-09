import * as fabric from "fabric"
import { DEFAULT_ANNOTATION_STYLE } from "~types/editor"

/**
 * 赤枠の四角形を作成
 */
export function createRectangle(
  left: number,
  top: number,
  width: number,
  height: number
): fabric.Rect {
  return new fabric.Rect({
    left: Math.min(left, left + width),
    top: Math.min(top, top + height),
    width: Math.abs(width),
    height: Math.abs(height),
    fill: "transparent",
    stroke: DEFAULT_ANNOTATION_STYLE.strokeColor,
    strokeWidth: DEFAULT_ANNOTATION_STYLE.strokeWidth,
    strokeUniform: true,
    originX: "left",
    originY: "top",
  })
}

/**
 * 矢印を作成（Line + Triangle のグループ）
 */
export function createArrow(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): fabric.Group {
  const angle = Math.atan2(endY - startY, endX - startX)
  const headLength = 15

  // 矢印の線
  const line = new fabric.Line([startX, startY, endX, endY], {
    stroke: DEFAULT_ANNOTATION_STYLE.strokeColor,
    strokeWidth: DEFAULT_ANNOTATION_STYLE.strokeWidth,
    originX: "left",
    originY: "top",
  })

  // 矢印の先端（三角形）- 先端なので中心基準のまま
  const triangle = new fabric.Triangle({
    left: endX,
    top: endY,
    width: headLength,
    height: headLength,
    fill: DEFAULT_ANNOTATION_STYLE.strokeColor,
    angle: (angle * 180) / Math.PI + 90,
    originX: "center",
    originY: "center",
  })

  return new fabric.Group([line, triangle], {
    originX: "left",
    originY: "top",
  })
}

/**
 * 編集可能なテキストを作成
 */
export function createText(x: number, y: number): fabric.IText {
  return new fabric.IText("テキスト", {
    left: x,
    top: y,
    fill: DEFAULT_ANNOTATION_STYLE.strokeColor,
    fontSize: DEFAULT_ANNOTATION_STYLE.fontSize,
    fontFamily: DEFAULT_ANNOTATION_STYLE.fontFamily,
    originX: "left",
    originY: "top",
  })
}

/**
 * Canvas を画像として書き出し
 */
export function exportCanvasToDataUrl(canvas: fabric.Canvas): string {
  return canvas.toDataURL({
    format: "png",
    quality: 1,
    multiplier: 1,
  })
}
