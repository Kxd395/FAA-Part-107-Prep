import SwiftUI

struct FlashcardsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var currentIndex: Int = 0
    @State private var showAnswer: Bool = false

    private var questions: [Question] {
        appState.studyVM.availableQuestions
    }

    private var currentQuestion: Question? {
        guard !questions.isEmpty else { return nil }
        let safe = max(0, min(currentIndex, questions.count - 1))
        return questions[safe]
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                HStack {
                    Text("Flashcards")
                        .font(.title3.weight(.semibold))
                    Spacer()
                    Text("\(questions.isEmpty ? 0 : currentIndex + 1)/\(questions.count)")
                        .font(.footnote)
                        .foregroundStyle(BrandColor.textMuted)
                }

                if let question = currentQuestion {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(question.category.rawValue)
                            .brandChip(active: true)
                        Text(showAnswer ? "Answer" : "Question")
                            .font(.caption)
                            .foregroundStyle(BrandColor.textMuted)
                        Text(showAnswer ? optionText(question: question) : question.questionText)
                            .font(.title3.weight(.medium))
                            .fixedSize(horizontal: false, vertical: true)
                        if showAnswer {
                            Text(question.explanationCorrect)
                                .font(.footnote)
                                .foregroundStyle(BrandColor.textMuted)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .brandCard()

                    HStack(spacing: 10) {
                        Button(showAnswer ? "Hide Answer" : "Show Answer") {
                            showAnswer.toggle()
                        }
                        .buttonStyle(SecondaryBrandButton())

                        Button("Next Card") {
                            advanceCard()
                        }
                        .buttonStyle(PrimaryBrandButton())
                    }
                } else {
                    ContentUnavailableView(
                        "No Flashcards Yet",
                        systemImage: "rectangle.stack",
                        description: Text("Load questions first from Study/Home.")
                    )
                    .brandCard()
                }

                Spacer()
            }
            .padding()
            .safeAreaPadding(.bottom, 92)
            .foregroundStyle(BrandColor.textPrimary)
            .brandScreen()
        }
    }

    private func advanceCard() {
        guard !questions.isEmpty else { return }
        currentIndex = (currentIndex + 1) % questions.count
        showAnswer = false
    }

    private func optionText(question: Question) -> String {
        question.options.first(where: { $0.id == question.correctOptionId })?.text ?? "No answer"
    }
}
