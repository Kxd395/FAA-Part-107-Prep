import SwiftUI

struct ProgressView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                HStack {
                    Text("Progress")
                        .font(.title3.weight(.semibold))
                    Spacer()
                }
                Text("Performance & Confidence")
                    .font(.title3.weight(.semibold))
                    .frame(maxWidth: .infinity, alignment: .leading)

                if let summary = appState.scoringSummary {
                    statRow(title: "Answers", value: "\(summary.answerCount)")
                    statRow(title: "Correct", value: "\(summary.correctCount)")
                    statRow(title: "First Answer Accuracy", value: "\(summary.firstAnswerAccuracyPercent)%")
                    statRow(title: "Final Answer Accuracy", value: "\(summary.finalAnswerAccuracyPercent)%")
                    statRow(
                        title: "Confidence Delta",
                        value: String(format: "%.1f", summary.confidenceCalibrationDelta)
                    )
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
            .safeAreaPadding(.bottom, 110)
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
