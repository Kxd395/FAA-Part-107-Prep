import SwiftUI

struct StudyView: View {
    @EnvironmentObject private var appState: AppState
    @ObservedObject var viewModel: StudySessionViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    HStack {
                        Text("Study Mode")
                            .font(.title3.weight(.semibold))
                        Spacer()
                    }
                    topBar
                    progressTrack
                    categorySelector

                    if let question = viewModel.currentQuestion {
                        questionCard(question)
                        options(question)
                        actionRow
                    } else {
                        ContentUnavailableView(
                            "No Questions",
                            systemImage: "tray",
                            description: Text("No matching questions loaded.")
                        )
                        .brandCard()
                    }
                }
                .padding()
                .safeAreaPadding(.bottom, 110)
            }
            .foregroundStyle(BrandColor.textPrimary)
            .brandScreen()
            .onChange(of: viewModel.selectedCategory) { _ in
                Task { await appState.persistStudyDraft() }
            }
        }
    }

    private var topBar: some View {
        HStack {
            Text("Question \(viewModel.currentIndex + 1) of \(max(viewModel.filteredQuestions.count, 1))")
                .font(.subheadline)
                .foregroundStyle(BrandColor.textMuted)
            Spacer()
            Text("Score: \(viewModel.correctCount)/\(max(viewModel.attemptedCount, 1))")
                .font(.subheadline.weight(.semibold))
        }
    }

    private var progressTrack: some View {
        let total = max(1, viewModel.filteredQuestions.count)
        let progress = CGFloat(viewModel.currentIndex + 1) / CGFloat(total)
        return GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(BrandColor.cardAlt)
                    .frame(height: 8)
                RoundedRectangle(cornerRadius: 8)
                    .fill(BrandColor.primary)
                    .frame(width: max(8, geo.size.width * progress), height: 8)
            }
        }
        .frame(height: 8)
    }

    private var categorySelector: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Category")
                .font(.caption)
                .foregroundStyle(BrandColor.textMuted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chipButton("All", isActive: viewModel.selectedCategory == nil) {
                        viewModel.applyCategory(nil)
                    }
                    ForEach(StudyCategory.allCases) { category in
                        chipButton(category.rawValue, isActive: viewModel.selectedCategory == category) {
                            viewModel.applyCategory(category)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .brandCard()
    }

    private func questionCard(_ question: Question) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(question.category.rawValue)
                    .brandChip(active: true)
                Text(question.subcategory)
                    .brandChip()
            }
            Text(question.questionText)
                .font(.title3.weight(.medium))
                .fixedSize(horizontal: false, vertical: true)
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
                    HStack(spacing: 12) {
                        Text(option.id)
                            .font(.subheadline.weight(.bold))
                            .frame(width: 30, height: 30)
                            .background(BrandColor.backgroundAlt)
                            .clipShape(Circle())
                        Text(option.text)
                            .font(.body)
                            .multilineTextAlignment(.leading)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(optionBackground(question: question, optionId: option.id))
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
                    .brandCard()
            }
        }
    }

    private var actionRow: some View {
        HStack(spacing: 10) {
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
    }

    private func optionBackground(question: Question, optionId: String) -> Color {
        guard viewModel.isAnswerSubmitted else { return BrandColor.card.opacity(0.95) }
        if optionId == question.correctOptionId { return BrandColor.success }
        if optionId == viewModel.selectedOptionId { return BrandColor.danger }
        return BrandColor.card.opacity(0.95)
    }

    private func chipButton(_ title: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .buttonStyle(.plain)
            .brandChip(active: isActive)
    }
}
