import { describe, it, expect, vi } from "vitest";

vi.mock("../../packages/runtime/src/ai/provider.js", () => ({
  getClient: vi.fn().mockReturnValue({
    messages: {
      create: vi.fn(),
    },
  }),
}));

import { auditWorkflowPlan, parseAuditResponse, buildAuditSystemPrompt } from "../../packages/runtime/src/ai/auditor.js";
import { getClient } from "../../packages/runtime/src/ai/provider.js";

describe("Auditor Module", () => {
  describe("parseAuditResponse", () => {
    it("parses valid JSON", () => {
      const result = parseAuditResponse(
        '{"score": 85, "summary": "Good workflow.", "issues": [{"severity": "warning", "message": "Missing retry"}], "suggestions": []}'
      );
      expect(result.score).toBe(85);
      expect(result.summary).toBe("Good workflow.");
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe("warning");
    });

    it("parses JSON with code fences", () => {
      const result = parseAuditResponse(
        '```json\n{"score": 90, "summary": "Great", "issues": [], "suggestions": []}\n```'
      );
      expect(result.score).toBe(90);
      expect(result.summary).toBe("Great");
    });

    it("parses bare JSON in text", () => {
      const result = parseAuditResponse(
        'Here is the result: {"score": 70, "summary": "OK", "issues": [], "suggestions": []}'
      );
      expect(result.score).toBe(70);
    });

    it("clamps score to 0-100", () => {
      const low = parseAuditResponse('{"score": -10, "summary": "test", "issues": [], "suggestions": []}');
      expect(low.score).toBe(0);

      const high = parseAuditResponse('{"score": 150, "summary": "test", "issues": [], "suggestions": []}');
      expect(high.score).toBe(100);
    });

    it("returns fallback on unparseable text", () => {
      const result = parseAuditResponse("I cannot audit this workflow.");
      expect(result.score).toBe(50);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain("could not be parsed");
    });

    it("defaults missing score to 50", () => {
      const result = parseAuditResponse('{"summary": "No score", "issues": [], "suggestions": []}');
      expect(result.score).toBe(50);
    });

    it("defaults missing arrays to empty", () => {
      const result = parseAuditResponse('{"score": 80, "summary": "test"}');
      expect(result.issues).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });
  });

  describe("buildAuditSystemPrompt", () => {
    it("returns a non-empty string", () => {
      const prompt = buildAuditSystemPrompt();
      expect(prompt).toContain("workflow quality auditor");
      expect(prompt).toContain("Error handling");
      expect(prompt).toContain("score");
    });
  });

  describe("auditWorkflowPlan", () => {
    it("calls Claude and returns parsed audit result", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              score: 92,
              summary: "Well-structured workflow.",
              issues: [],
              suggestions: [{ severity: "info", message: "Consider adding a delay" }],
            }),
          },
        ],
      });

      (getClient as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: { create: mockCreate },
      });

      const result = await auditWorkflowPlan({
        name: "Test",
        description: "Test workflow",
        trigger: { type: "manual" },
        steps: [{ id: "s1", name: "Step 1", type: "notify", onError: "continue" }],
      });

      expect(result.score).toBe(92);
      expect(result.summary).toBe("Well-structured workflow.");
      expect(result.suggestions).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
        })
      );
    });
  });
});
