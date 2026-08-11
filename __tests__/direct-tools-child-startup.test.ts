import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Generic promisify resolves only execFile's first callback value on supported
// Node versions here, dropping stderr. Keep this wrapper local to the child test.
function execFileAsync(file: string, args: string[], options: Parameters<typeof execFile>[2]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { ...options, encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("direct tools in child Pi processes", () => {
  it("keeps an env-selected cold-cache server lazy before explicit discovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-mcp-direct-tool-child-"));
    roots.push(root);
    const agentDir = join(root, "agent");
    const projectDir = join(root, "project");
    await Promise.all([mkdir(agentDir), mkdir(projectDir)]);
    const configPath = join(agentDir, "mcp.json");
    await writeFile(configPath, JSON.stringify({
      mcpServers: {
        demo: {
          command: process.execPath,
          args: [resolve("__tests__/fixtures/delayed-mcp-server.mjs")],
        },
      },
    }));

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", "tsx", resolve("__tests__/fixtures/direct-tools-child-harness.ts")],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PI_CODING_AGENT_DIR: agentDir,
          MCP_CHILD_CONFIG: configPath,
          MCP_CHILD_PROJECT_DIR: projectDir,
          MCP_CHILD_ADAPTER_PATH: resolve("index.ts"),
          MCP_CHILD_PROBE_PATH: resolve("__tests__/fixtures/direct-tools-agent-start-probe.ts"),
          MCP_DIRECT_TOOLS: "demo/reload_identity",
        },
        timeout: 15_000,
      },
    );

    expect(stderr).not.toContain("MCP initialization failed");
    const toolsLine = stdout.split("\n").find(line => line.startsWith("DIRECT_TOOLS_AT_AGENT_START="));
    expect(toolsLine).toBeDefined();
    expect(JSON.parse(toolsLine!.slice("DIRECT_TOOLS_AT_AGENT_START=".length))).not.toContain("demo_reload_identity");
  }, 20_000);
});
