import { describe, expect, it } from "vitest";
import en from "@/messages/en-US.json";
import zh from "@/messages/zh-CN.json";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("message resources", () => {
  it("keeps zh-CN and en-US keys in sync", () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(zh).sort());
  });
});
