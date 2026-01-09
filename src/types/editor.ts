/**
 * エディタで使用可能な注釈ツール
 */
export type AnnotationTool = "select" | "rectangle" | "arrow" | "text"

/**
 * 注釈のスタイル設定
 */
export interface AnnotationStyle {
  strokeColor: string
  strokeWidth: number
  fontSize: number
  fontFamily: string
}

/**
 * デフォルトの注釈スタイル
 */
export const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = {
  strokeColor: "#FF0000",
  strokeWidth: 3,
  fontSize: 20,
  fontFamily: "Arial",
}
