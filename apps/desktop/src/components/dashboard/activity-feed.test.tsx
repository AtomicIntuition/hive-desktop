import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "./activity-feed";

describe("ActivityFeed", () => {
  it("renders the activity section", () => {
    render(<ActivityFeed />);
    expect(screen.getByText("Activity")).toBeDefined();
  });

  it("shows welcome message", () => {
    render(<ActivityFeed />);
    expect(screen.getByText(/Welcome to Hive Desktop/)).toBeDefined();
  });
});
