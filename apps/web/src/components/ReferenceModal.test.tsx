import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { ReferenceModal, type ResolvedReference } from "./ReferenceModal";

describe("ReferenceModal", () => {
  afterEach(() => {
    cleanup();
  });

  const imageRef: ResolvedReference = {
    type: "image",
    label: "Figure 17",
    description: "Winds aloft figure",
    url: "/figures/figure-17.png",
  };

  it("renders image controls and toggles hand mode", () => {
    render(<ReferenceModal ref_={imageRef} onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Zoom +" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom -" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit Width" })).toBeInTheDocument();

    const handToggle = screen.getByRole("button", { name: "Hand Off" });
    fireEvent.click(handToggle);
    expect(screen.getByRole("button", { name: "Hand On" })).toBeInTheDocument();
  });

  it("marks only the header as draggable affordance", () => {
    const { container } = render(<ReferenceModal ref_={imageRef} onClose={vi.fn()} />);
    const panel = container.querySelector('[role="dialog"]') as HTMLDivElement;
    const headerTitle = within(panel).getByRole("heading", { name: "Figure 17" });
    const header = headerTitle.closest("div")?.parentElement as HTMLDivElement;
    const image = within(panel).getByRole("img", { name: "Figure 17" });

    expect(header.className).toContain("cursor-move");
    expect(image.parentElement?.className).not.toContain("cursor-move");
  });

  it("supports ctrl/cmd wheel zoom and keeps modal open", () => {
    const { container } = render(<ReferenceModal ref_={imageRef} onClose={vi.fn()} />);
    const panel = container.querySelector('[role="dialog"]') as HTMLDivElement;

    const image = within(panel).getByRole("img", { name: "Figure 17" }) as HTMLImageElement;
    Object.defineProperty(image, "naturalWidth", { value: 1200, configurable: true });
    fireEvent.load(image);

    const scrollContainer = image.closest(".overflow-auto") as HTMLDivElement;
    fireEvent.wheel(scrollContainer, { deltaY: -50, ctrlKey: true });
    fireEvent.wheel(scrollContainer, { deltaY: -50, metaKey: true });

    expect(screen.getByRole("button", { name: "Fit Width" })).toBeInTheDocument();
  });
});
