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

    struct SubmitResult {
        let question: Question
        let selectedOptionId: String
        let isCorrect: Bool
    }

    func submitAnswer(_ optionId: String) -> SubmitResult? {
        guard let question = currentQuestion, !isAnswerSubmitted else { return nil }
        selectedOptionId = optionId
        isAnswerSubmitted = true
        attemptedCount += 1
        let isCorrect = question.correctOptionId == optionId
        if isCorrect {
            correctCount += 1
        }
        return SubmitResult(question: question, selectedOptionId: optionId, isCorrect: isCorrect)
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

    func snapshot() -> StudyDraftSnapshot {
        StudyDraftSnapshot(
            category: selectedCategory?.rawValue,
            currentIndex: currentIndex,
            selectedOptionId: selectedOptionId,
            isAnswerSubmitted: isAnswerSubmitted,
            correctCount: correctCount,
            attemptedCount: attemptedCount,
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
    }

    func restore(from snapshot: StudyDraftSnapshot) {
        if let categoryName = snapshot.category,
           let restoredCategory = StudyCategory(rawValue: categoryName) {
            applyCategory(restoredCategory)
        } else {
            applyCategory(nil)
        }

        if filteredQuestions.isEmpty {
            return
        }

        currentIndex = max(0, min(snapshot.currentIndex, filteredQuestions.count - 1))
        selectedOptionId = snapshot.selectedOptionId
        isAnswerSubmitted = snapshot.isAnswerSubmitted
        correctCount = max(0, snapshot.correctCount)
        attemptedCount = max(0, snapshot.attemptedCount)
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
