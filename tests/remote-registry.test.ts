import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchRegistry } from "../src/core/remote-registry.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchRegistry", () => {
  it("parses a valid registry manifest", async () => {
    const manifest = {
      version: "1",
      name: "test-registry",
      description: "A test registry",
      skills: [
        {
          name: "skill-a",
          description: "Skill A",
          source: "github:user/repo/skill-a",
          version: "1.0.0",
          tags: ["test"],
          author: "Test Author",
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(manifest),
      })
    );

    const result = await fetchRegistry("https://example.com/registry.json");
    expect(result.name).toBe("test-registry");
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe("skill-a");
  });

  it("throws on invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error("bad json")),
      })
    );

    await expect(
      fetchRegistry("https://example.com/bad.json")
    ).rejects.toThrow("invalid JSON");
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
    );

    await expect(
      fetchRegistry("https://example.com/missing.json")
    ).rejects.toThrow("HTTP 404");
  });

  it("throws on unsupported version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            version: "2",
            name: "future-registry",
            skills: [],
          }),
      })
    );

    await expect(
      fetchRegistry("https://example.com/v2.json")
    ).rejects.toThrow('Unsupported registry version "2"');
  });

  it("throws when name field is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            version: "1",
            skills: [],
          }),
      })
    );

    await expect(
      fetchRegistry("https://example.com/noname.json")
    ).rejects.toThrow('missing a "name" field');
  });

  it("throws when skills array is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            version: "1",
            name: "broken",
          }),
      })
    );

    await expect(
      fetchRegistry("https://example.com/noskills.json")
    ).rejects.toThrow('missing a "skills" array');
  });
});
