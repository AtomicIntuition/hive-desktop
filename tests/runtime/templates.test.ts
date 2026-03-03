import { describe, it, expect } from "vitest";
import { getTemplates, getTemplate } from "../../packages/runtime/src/workflow/templates.js";

describe("Workflow Templates", () => {
  it("has exactly 10 templates", () => {
    const templates = getTemplates();
    expect(templates).toHaveLength(10);
  });

  it("all templates have required fields", () => {
    const templates = getTemplates();
    for (const t of templates) {
      expect(t.slug).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.requiredServers.length).toBeGreaterThan(0);
      expect(t.trigger).toBeTruthy();
      expect(t.steps.length).toBeGreaterThan(0);
    }
  });

  it("all templates have unique slugs", () => {
    const templates = getTemplates();
    const slugs = templates.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("all steps have valid types", () => {
    const validTypes = ["mcp_call", "condition", "transform", "delay", "notify"];
    const templates = getTemplates();
    for (const t of templates) {
      for (const step of t.steps) {
        expect(validTypes).toContain(step.type);
      }
    }
  });

  it("all steps have valid onError values", () => {
    const validErrors = ["stop", "continue", "retry"];
    const templates = getTemplates();
    for (const t of templates) {
      for (const step of t.steps) {
        expect(validErrors).toContain(step.onError);
      }
    }
  });

  it("mcp_call steps have server and tool", () => {
    const templates = getTemplates();
    for (const t of templates) {
      for (const step of t.steps) {
        if (step.type === "mcp_call") {
          expect(step.server).toBeTruthy();
          expect(step.tool).toBeTruthy();
        }
      }
    }
  });

  it("retry steps have retryCount and retryDelay", () => {
    const templates = getTemplates();
    for (const t of templates) {
      for (const step of t.steps) {
        if (step.onError === "retry") {
          expect(step.retryCount).toBeGreaterThan(0);
          expect(step.retryDelay).toBeGreaterThan(0);
        }
      }
    }
  });

  describe("getTemplate", () => {
    it("finds template by slug", () => {
      const t = getTemplate("payment-monitor");
      expect(t).toBeDefined();
      expect(t?.name).toBe("Payment Monitor");
    });

    it("returns undefined for unknown slug", () => {
      expect(getTemplate("does-not-exist")).toBeUndefined();
    });

    const expectedTemplates = [
      "payment-monitor",
      "issue-triager",
      "error-alerter",
      "daily-digest",
      "deploy-watcher",
      "customer-onboarding",
      "dependency-auditor",
      "content-pipeline",
      "competitor-monitor",
      "database-backup-alert",
    ];

    it.each(expectedTemplates)("template '%s' exists", (slug) => {
      expect(getTemplate(slug)).toBeDefined();
    });
  });

  describe("trigger types", () => {
    it("includes schedule triggers", () => {
      const templates = getTemplates();
      const scheduleTemplates = templates.filter((t) => t.trigger.type === "schedule");
      expect(scheduleTemplates.length).toBeGreaterThan(0);

      for (const t of scheduleTemplates) {
        if (t.trigger.type === "schedule") {
          expect(t.trigger.cron).toBeTruthy();
        }
      }
    });

    it("includes interval triggers", () => {
      const templates = getTemplates();
      const intervalTemplates = templates.filter((t) => t.trigger.type === "interval");
      expect(intervalTemplates.length).toBeGreaterThan(0);

      for (const t of intervalTemplates) {
        if (t.trigger.type === "interval") {
          expect(t.trigger.seconds).toBeGreaterThan(0);
        }
      }
    });

    it("includes file_watch trigger", () => {
      const templates = getTemplates();
      const fileWatchTemplates = templates.filter((t) => t.trigger.type === "file_watch");
      expect(fileWatchTemplates.length).toBeGreaterThan(0);
    });
  });
});
