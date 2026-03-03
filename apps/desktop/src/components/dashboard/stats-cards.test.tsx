import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsCards } from "./stats-cards";

describe("StatsCards", () => {
  it("renders all four stat cards", () => {
    render(
      <StatsCards
        activeWorkflows={5}
        runningServers={3}
        totalRuns={42}
        errorRate={7}
      />
    );

    expect(screen.getByText("Active Workflows")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("Running Servers")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("Total Runs")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("Error Rate")).toBeDefined();
    expect(screen.getByText("7%")).toBeDefined();
  });

  it("renders zero values", () => {
    render(
      <StatsCards activeWorkflows={0} runningServers={0} totalRuns={0} errorRate={0} />
    );
    expect(screen.getByText("0%")).toBeDefined();
  });
});
