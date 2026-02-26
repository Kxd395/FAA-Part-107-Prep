import Foundation
import SwiftUI

@MainActor
final class StudySessionViewModel: ObservableObject {
    @Published private(set) var availableQuestions: [Question] = []
    @Published var filteredQuestions: [Question] = []
    @Published var selectedCategory: StudyCategory?
    @Published var currentIndex: Int = 0
    @Published var selectedOptionId: String?
    @Published var isAnswerSubmitted: Bool = false
    @Published var correctCount: Int = 0
    @Published var attemptedCount: Int = 0
    @Published var errorMessage: String?

    private let repository: QuestionRepository

    init(repository: QuestionRepository) {
        self.repository = repository
    }

    var currentQuestion: Question? {
        guard currentIndex >= 0, currentIndex < filteredQuestions.count else { return nil }
        return filteredQuestions[currentIndex]
    }

    func loadInitialQuestions() async {
        do {
            let questions = try await repository.fetchQuestions()
            availableQuestions = questions
            applyCategory(nil)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func applyCategory(_ category: StudyCategory?) {
        selectedCategory = category
        if let category {
            filteredQuestions = availableQuestions.filter { $0.category == category }
        } else {
            filteredQuestions = availableQuestions
        }
        resetSessionProgress()
    }

    func submitAnswer(_ optionId: String) {
        guard let question = currentQuestion, !isAnswerSubmitted else { return }
        selectedOptionId = optionId
        isAnswerSubmitted = true
        attemptedCount += 1
        if question.correctOptionId == optionId {
            correctCount += 1
        }
    }

    func nextQuestion() {
        guard currentIndex < filteredQuestions.count - 1 else { return }
        currentIndex += 1
        selectedOptionId = nil
        isAnswerSubmitted = false
    }

    func startOver() {
        resetSessionProgress()
    }

    func scorePercent() -> Int {
        guard attemptedCount > 0 else { return 0 }
        return Int((Double(correctCount) / Double(attemptedCount) * 100).rounded())
    }

    private func resetSessionProgress() {
        currentIndex = 0
        selectedOptionId = nil
        isAnswerSubmitted = false
        correctCount = 0
        attemptedCount = 0
    }
}
