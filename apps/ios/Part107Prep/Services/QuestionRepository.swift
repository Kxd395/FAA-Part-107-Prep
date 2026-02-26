import Foundation

actor QuestionRepository {
    private let client: APIClient
    private let useLocalFallback: Bool

    init(config: AppConfig) {
        self.client = APIClient(config: config)
        self.useLocalFallback = config.useLocalQuestionFallback
    }

    func fetchQuestions(category: String = "All", questionType: String = "confirmed_test") async throws -> [Question] {
        do {
            return try await client.getQuestions(category: category, questionType: questionType)
        } catch {
            guard useLocalFallback else { throw error }
            return try loadBundledQuestions()
        }
    }

    func loadBundledQuestions() throws -> [Question] {
        guard let url = Bundle.main.url(forResource: "runtime_question_bank", withExtension: "json") else {
            throw APIError.invalidURL
        }

        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([Question].self, from: data)
    }
}
