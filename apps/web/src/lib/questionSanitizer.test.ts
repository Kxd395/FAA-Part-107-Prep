import { describe, expect, it } from "vitest";
import { extractImageRefFromText, sanitizeQuestion, sanitizeQuestionText } from "./questionSanitizer";

const SAMPLE_QUESTION = {
  id: "AIR-ACS-051",
  category: "Airspace",
  subcategory: "Airspace Operations",
  question_text:
    'Which ACS knowledge code matches this topic: "sUAS lighting requirements. ### Images ![Page 16 image](../images/uas-acsocr/p016_img01_5b91968bce71.png) - `image=p016_img01_5b91968bce71.png` `size=2341x196` `bbox_area_ratio=0.0545`"?',
  figure_reference: null,
  options: [
    { id: "A", text: "UA.II.B.K9" },
    {
      id: "B",
      text: "sUAS lighting requirements. ### Images ![Page 16 image](../images/uas-acsocr/p016_img01_5b91968bce71.png) - `image=p016_img01_5b91968bce71.png` `size=2341x196` `bbox_area_ratio=0.0545`",
    },
    { id: "C", text: "UA.II.B.K8" },
  ],
  correct_option_id: "A",
  explanation_correct: "Because A is right.",
  explanation_distractors: { B: "B is wrong", C: "C is wrong" },
  citation: "Part 107 ACS",
  difficulty_level: 2,
  tags: [],
  source_type: "acs_generated",
} as const;

describe("question sanitizer", () => {
  it("extracts markdown image refs to public paths", () => {
    const ref = extractImageRefFromText(
      "### Images ![Page 16 image](../images/uas-acsocr/p016_img01_5b91968bce71.png)"
    );
    expect(ref).toBe("/images/uas-acsocr/p016_img01_5b91968bce71.png");
  });

  it("removes image metadata blocks from prompt and options", () => {
    const cleaned = sanitizeQuestion(SAMPLE_QUESTION);
    expect(cleaned.image_ref).toBeNull();
    expect(cleaned.question_text).not.toContain("### Images");
    expect(cleaned.options[1].text).not.toContain("### Images");
    expect(cleaned.options[1].text).toBe("sUAS lighting requirements.");
  });

  it("handles standalone image tags", () => {
    const text = "Topic text `image=p009_img01_5b91968bce71.png` `size=2341x196`";
    expect(sanitizeQuestionText(text)).toBe("Topic text");
  });

  it("normalizes existing relative image_ref values", () => {
    const cleaned = sanitizeQuestion({
      ...SAMPLE_QUESTION,
      source_type: undefined,
      image_ref: "../figures/figure-20.png",
    });

    expect(cleaned.image_ref).toBe("/figures/figure-20.png");
  });
});
