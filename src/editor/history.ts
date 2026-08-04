export class EditHistory<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private present: T) {}
  push(next: T): T { this.past.push(structuredClone(this.present)); this.present = structuredClone(next); this.future = []; return this.current(); }
  undo(): T { const value = this.past.pop(); if (value) { this.future.push(structuredClone(this.present)); this.present = value; } return this.current(); }
  redo(): T { const value = this.future.pop(); if (value) { this.past.push(structuredClone(this.present)); this.present = value; } return this.current(); }
  replace(value: T): void { this.present = structuredClone(value); this.past = []; this.future = []; }
  current(): T { return structuredClone(this.present); }
}
