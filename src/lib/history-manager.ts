/**
 * Canvas の状態履歴を管理するクラス
 * Undo/Redo 機能を提供する
 */
export class HistoryManager {
  private stack: string[] = []
  private index: number = -1
  private maxHistory: number

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory
  }

  /**
   * 現在の状態をスタックに追加
   */
  push(state: string): void {
    // 現在位置より後の履歴を削除（新しい操作で上書き）
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1)
    }

    this.stack.push(state)
    this.index = this.stack.length - 1

    // 最大履歴数を超えたら古いものを削除
    if (this.stack.length > this.maxHistory) {
      this.stack.shift()
      this.index--
    }
  }

  /**
   * 前の状態に戻る
   */
  undo(): string | null {
    if (!this.canUndo()) {
      return null
    }
    this.index--
    return this.stack[this.index]
  }

  /**
   * 次の状態に進む
   */
  redo(): string | null {
    if (!this.canRedo()) {
      return null
    }
    this.index++
    return this.stack[this.index]
  }

  /**
   * Undo が可能かどうか
   */
  canUndo(): boolean {
    return this.index > 0
  }

  /**
   * Redo が可能かどうか
   */
  canRedo(): boolean {
    return this.index < this.stack.length - 1
  }

  /**
   * 履歴をクリア
   */
  clear(): void {
    this.stack = []
    this.index = -1
  }

  /**
   * 初期状態を設定（最初の履歴として記録）
   */
  initialize(state: string): void {
    this.clear()
    this.push(state)
  }
}
