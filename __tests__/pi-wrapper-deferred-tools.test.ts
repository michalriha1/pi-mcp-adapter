import { describe, expect, it } from "vitest";
import { Type } from "typebox";
import { wrapRegisteredTool } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/wrapper.js";

describe("Pi registered-tool wrapper deferred attribution", () => {
  it("reports only additive loader names while preserving every entry active name", async () => {
    let activeTools = ["bash", "mcp", "foreign_active_tool"];
    const runner = {
      createContext: () => ({}),
      getActiveTools: () => [...activeTools],
    };
    const wrapped = wrapRegisteredTool({
      definition: {
        name: "mcp",
        label: "MCP",
        description: "deferred loader",
        parameters: Type.Object({}),
        executionMode: "sequential" as const,
        async execute() {
          activeTools = [...activeTools, "demo_search"];
          return { content: [{ type: "text" as const, text: "found" }], details: {} };
        },
      },
      sourceInfo: {} as never,
    }, runner as never);

    const result = await wrapped.execute("search", {}, undefined, undefined);

    expect(activeTools).toEqual(["bash", "mcp", "foreign_active_tool", "demo_search"]);
    expect(result.addedToolNames).toEqual(["demo_search"]);
  });
});
