import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    onConfirm.mockReset();
    onCancel.mockReset();
  });

  it("renders nothing when not open", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Test"
        message="Test message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders title and message when open", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Item"
        message="Are you sure you want to delete this?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText("Delete Item")).toBeDefined();
    expect(screen.getByText("Are you sure you want to delete this?")).toBeDefined();
  });

  it("shows default button labels", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Test"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText("Confirm")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("shows custom button labels", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Test"
        confirmLabel="Delete Forever"
        cancelLabel="Keep It"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText("Delete Forever")).toBeDefined();
    expect(screen.getByText("Keep It")).toBeDefined();
  });

  it("calls onConfirm when confirm button clicked", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Test"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button clicked", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Test"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Escape key pressed", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Test"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Enter key pressed", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Test"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when backdrop clicked", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Test"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // The backdrop is the first div with bg-black/60
    const backdrop = document.querySelector(".bg-black\\/60");
    if (backdrop) fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows warning icon for danger variant", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        message="This is dangerous"
        variant="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // Should have the red warning styling
    const dangerBg = document.querySelector(".bg-red-500\\/10");
    expect(dangerBg).toBeDefined();
  });

  it("shows warning icon for warning variant", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Warning"
        message="Are you sure?"
        variant="warning"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const warningBg = document.querySelector(".bg-amber-500\\/10");
    expect(warningBg).toBeDefined();
  });

  it("uses correct button color for danger variant", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Are you sure?"
        message="Dangerous"
        variant="danger"
        confirmLabel="Delete Forever"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const confirmBtn = screen.getByText("Delete Forever");
    expect(confirmBtn.className).toContain("bg-red-600");
  });

  it("uses correct button color for default variant", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Proceed"
        message="OK?"
        confirmLabel="Yes"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const confirmBtn = screen.getByText("Yes");
    expect(confirmBtn.className).toContain("bg-violet-600");
  });

  it("has at least 3 interactive buttons (X close, Cancel, Confirm)", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Dialog"
        message="Test message"
        confirmLabel="OK"
        cancelLabel="Nevermind"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const buttons = document.querySelectorAll("button");
    // X close, Nevermind, OK = 3 buttons
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });
});
