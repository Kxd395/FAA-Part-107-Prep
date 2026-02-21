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
    expect(cleaned.image_ref).toBe("/images/uas-acsocr/p016_img01_5b91968bce71.png");
    expect(cleaned.question_text).not.toContain("### Images");
    expect(cleaned.options[1].text).not.toContain("### Images");
    expect(cleaned.options[1].text).toBe("sUAS lighting requirements.");
  });

  it("handles standalone image tags", () => {
    const text = "Topic text `image=p009_img01_5b91968bce71.png` `size=2341x196`";
    expect(sanitizeQuestionText(text)).toBe("Topic text");
  });

  it("sanitizes explanation fields and suppresses ACS OCR strip image refs", () => {
    const cleaned = sanitizeQuestion({
      ...SAMPLE_QUESTION,
      source_type: "acs_generated",
      explanation_correct:
        "UA.II.B.K1k corresponds to k. Lightning ### Images ![Page 18 image](../images/uas-acsocr/p018_img01_5b91968bce71.png)",
      explanation_distractors: {
        B: 'Wrong because of X. `image=p018_img01_5b91968bce71.png` `size=2341x196`',
      },
    });

    expect(cleaned.image_ref).toBeNull();
    expect(cleaned.explanation_correct).not.toContain("### Images");
    expect(cleaned.explanation_distractors.B).not.toContain("image=");
  });

  it("normalizes existing relative image_ref values", () => {
    const cleaned = sanitizeQuestion({
      ...SAMPLE_QUESTION,
      image_ref: "../images/uas-acsocr/p016_img01_5b91968bce71.png",
    });

    expect(cleaned.image_ref).toBe("/images/uas-acsocr/p016_img01_5b91968bce71.png");
  });
});
