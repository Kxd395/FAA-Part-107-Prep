import XCTest
@testable import Part107Prep

final class QuestionDecodingTests: XCTestCase {
    func testDecodesQuestionApiResponse() throws {
        let json = """
        {
          "questions": [
            {
              "id": "Q-1",
              "category": "Regulations",
              "subcategory": "General",
              "question_text": "What is the max altitude?",
              "figure_reference": null,
              "image_ref": null,
              "options": [
                {"id":"A","text":"400 ft"},
                {"id":"B","text":"500 ft"},
                {"id":"C","text":"600 ft"}
              ],
              "correct_option_id": "A",
              "explanation_correct": "Part 107.51",
              "explanation_distractors": {"B":"No","C":"No"},
              "citation": "14 CFR 107.51",
              "difficulty_level": 2,
              "source_type": "confirmed_test"
            }
          ]
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(QuestionApiResponse.self, from: json)
        XCTAssertEqual(decoded.questions.count, 1)
        XCTAssertEqual(decoded.questions[0].category, .regulations)
        XCTAssertEqual(decoded.questions[0].correctOptionId, "A")
    }
}
