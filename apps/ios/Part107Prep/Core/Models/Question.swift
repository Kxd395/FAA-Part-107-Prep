import Foundation

enum StudyCategory: String, Codable, CaseIterable, Identifiable {
    case regulations = "Regulations"
    case airspace = "Airspace"
    case weather = "Weather"
    case operations = "Operations"
    case loadingPerformance = "Loading & Performance"

    var id: String { rawValue }
}

struct QuestionOption: Codable, Identifiable, Hashable {
    let id: String
    let text: String
}

struct Question: Codable, Identifiable, Hashable {
    let id: String
    let category: StudyCategory
    let subcategory: String
    let questionText: String
    let figureReference: String?
    let imageRef: String?
    let options: [QuestionOption]
    let correctOptionId: String
    let explanationCorrect: String
    let explanationDistractors: [String: String]
    let citation: String
    let difficultyLevel: Int
    let sourceType: String?

    enum CodingKeys: String, CodingKey {
        case id
        case category
        case subcategory
        case options
        case citation
        case questionText = "question_text"
        case figureReference = "figure_reference"
        case imageRef = "image_ref"
        case correctOptionId = "correct_option_id"
        case explanationCorrect = "explanation_correct"
        case explanationDistractors = "explanation_distractors"
        case difficultyLevel = "difficulty_level"
        case sourceType = "source_type"
    }
}

struct QuestionApiResponse: Codable {
    let questions: [Question]
}
