import { describe, expect, it } from "vitest";
import { resolveFigureImageUrl } from "./figureImage";

describe("resolveFigureImageUrl", () => {
  it("prefers explicit image_ref", () => {
    expect(
      resolveFigureImageUrl({ image_ref: "/images/uas-acsocr/p012_img01_5b91968bce71.png", figure_reference: "figure-20" })
    ).toBe("/images/uas-acsocr/p012_img01_5b91968bce71.png");
  });

  it("falls back to figure_reference local asset", () => {
    expect(resolveFigureImageUrl({ image_ref: null, figure_reference: "figure-26" })).toBe(
      "/figures/figure-26.png"
    );
  });

  it("routes chapter-figure references to remote pilot 2016 image inventory", () => {
    expect(resolveFigureImageUrl({ image_ref: null, figure_reference: "figure-2-4" })).toBe(
      "/figures/rpsg-2016/rpsg2016-figure-2-4.jpeg"
    );
  });

  it("returns null when no image source is available", () => {
    expect(resolveFigureImageUrl({ image_ref: null, figure_reference: null })).toBeNull();
  });
});
