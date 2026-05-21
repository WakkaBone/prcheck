import { describe, it, expect } from "vitest";
import { extractChangedLines } from "../src/patch.js";

describe("extractChangedLines", () => {
  it("returns empty array for undefined patch", () => {
    expect(extractChangedLines(undefined)).toEqual([]);
  });

  it("returns empty array for empty patch", () => {
    expect(extractChangedLines("")).toEqual([]);
  });

  it("parses a simple addition", () => {
    const patch = `@@ -1,3 +1,4 @@
 context
+new line
 context
 context`;
    const result = extractChangedLines(patch);
    expect(result).toContain(2);   // "new line" is at line 2
    expect(result).toHaveLength(1);
  });

  it("handles multiple hunks", () => {
    const patch = `@@ -1,3 +1,4 @@
 context
+added here
 context
@@ -20,3 +21,4 @@
 context
+added there
 context`;
    const result = extractChangedLines(patch);
    expect(result).toContain(2);   // first addition
    expect(result).toContain(22);  // second addition
    expect(result).toHaveLength(2);
  });

  it("does not count removed lines as new-file lines", () => {
    const patch = `@@ -1,4 +1,3 @@
 context
-removed line
 context
 context`;
    // Only context lines advance the cursor; removed line does not
    const result = extractChangedLines(patch);
    expect(result).toHaveLength(0);
  });

  it("handles additions at the start of file", () => {
    const patch = `@@ -0,0 +1,2 @@
+first line
+second line`;
    const result = extractChangedLines(patch);
    expect(result).toEqual([1, 2]);
  });

  it("ignores the +++ header line", () => {
    const patch = `+++ b/src/foo.ts
@@ -1,2 +1,3 @@
 context
+added`;
    const result = extractChangedLines(patch);
    expect(result).toHaveLength(1);
    expect(result).toContain(2);
  });
});
