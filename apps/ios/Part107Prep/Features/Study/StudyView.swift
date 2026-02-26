import SwiftUI

struct StudyView: View {
    @EnvironmentObject private var appState: AppState
    @ObservedObject var viewModel: StudySessionViewModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                categoryPicker

                if let question = viewModel.currentQuestion {
                    questionCard(question)
                    options(question)

                    HStack(spacing: 12) {
                        Button("Next") {
                            viewModel.nextQuestion()
                            Task { await appState.persistStudyDraft() }
                        }
                        .buttonStyle(PrimaryBrandButton())

                        Button("Restart") {
                            viewModel.startOver()
                            Task { await appState.persistStudyDraft() }
                        }
                        .buttonStyle(SecondaryBrandButton())
                    }
                } else {
                    ContentUnavailableView("No Questions", systemImage: "tray", description: Text("No matching questions loaded."))
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Study")
            .foregroundStyle(BrandColor.textPrimary)
            .brandScreen()
            .onChange(of: viewModel.selectedCategory) { _ in
                Task { await appState.persistStudyDraft() }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Text("\(viewModel.currentIndex + 1)/\(max(viewModel.filteredQuestions.count, 1))")
                        .font(.footnote)
                        .foregroundStyle(BrandColor.textMuted)
                }
            }
        }
    }

    private var categoryPicker: some View {
        Picker("Category", selection: Binding(
            get: { viewModel.selectedCategory },
            set: { viewModel.applyCategory($0) }
        )) {
            Text("All").tag(StudyCategory?.none)
            ForEach(StudyCategory.allCases) { category in
                Text(category.rawValue).tag(StudyCategory?.some(category))
            }
        }
        .pickerStyle(.menu)
    }

    private func questionCard(_ question: Question) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(question.category.rawValue)
                .font(.caption)
                .foregroundStyle(BrandColor.textMuted)
            Text(question.questionText)
                .font(.headline)
            Text("Score: \(viewModel.scorePercent())%")
                .font(.caption)
                .foregroundStyle(BrandColor.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .brandCard()
    }

    private func options(_ question: Question) -> some View {
        VStack(spacing: 10) {
            ForEach(question.options) { option in
                Button {
                    guard let result = viewModel.submitAnswer(option.id) else { return }
                    Task {
                        await appState.trackAnswer(result: result)
                        await appState.persistStudyDraft()
                        await appState.refreshScoringSummary()
                    }
                } label: {
                    HStack {
                        Text(option.id)
                            .font(.subheadline.weight(.semibold))
                            .frame(width: 28, height: 28)
                            .background(BrandColor.backgroundAlt)
                            .clipShape(Circle())
                        Text(option.text)
                            .multilineTextAlignment(.leading)
                        Spacer()
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(backgroundColor(question: question, optionId: option.id))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(BrandColor.border, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .disabled(viewModel.isAnswerSubmitted)
            }

            if viewModel.isAnswerSubmitted {
                Text(question.explanationCorrect)
                    .font(.footnote)
                    .foregroundStyle(BrandColor.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func backgroundColor(question: Question, optionId: String) -> Color {
        guard viewModel.isAnswerSubmitted else { return BrandColor.card.opacity(0.92) }
        if optionId == question.correctOptionId { return BrandColor.success }
        if optionId == viewModel.selectedOptionId { return BrandColor.danger }
        return BrandColor.card.opacity(0.92)
    }
}
