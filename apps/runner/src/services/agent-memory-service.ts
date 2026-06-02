import type { LlmAction } from "./llm-action-parser.js";

type MemoryEntry = {
  timestamp: string;
  action: LlmAction["action"];
  target: string;
  result: "started" | "completed" | "failed";
  reason: string;
  frustrationDelta: number;
};

export class AgentMemoryService {
  private entries: MemoryEntry[] = [];

  record(entry: MemoryEntry): void {
    this.entries.push(entry);
    if (this.entries.length > 20) {
      this.entries.shift();
    }
  }

  recentActions(limit = 8): MemoryEntry[] {
    return this.entries.slice(-limit);
  }

  frustrationScore(): number {
    return this.entries.reduce((sum, item) => sum + item.frustrationDelta, 0);
  }
}
