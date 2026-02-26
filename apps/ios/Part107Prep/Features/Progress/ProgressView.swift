import SwiftUI

struct ProgressView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                if let summary = appState.scoringSummary {
                    statRow(title: "Answers", value: "\(summary.answerCount)")
                    statRow(title: "Correct", value: "\(summary.correctCount)")
                    statRow(title: "First Answer Accuracy", value: "\(summary.firstAnswerAccuracyPercent)%")
                    statRow(title: "Final Answer Accuracy", value: "\(summary.finalAnswerAccuracyPercent)%")
                } else {
                    ContentUnavailableView(
                        "No Synced Stats Yet",
                        systemImage: "chart.bar",
                        description: Text("Sign in and answer questions to populate server scoring.")
                    )
                }

                Button("Refresh") {
                    Task { await appState.refreshScoringSummary() }
                }
                .buttonStyle(PrimaryBrandButton())
                Spacer()
            }
            .padding()
            .navigationTitle("Progress")
            .foregroundStyle(BrandColor.textPrimary)
            .brandScreen()
        }
    }

    private func statRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(BrandColor.textMuted)
            Spacer()
            Text(value)
                .font(.headline)
        }
        .brandCard()
    }
}
