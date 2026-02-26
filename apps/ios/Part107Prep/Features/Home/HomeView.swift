import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    VStack(spacing: 8) {
                        Text("Part 107 Prep")
                            .font(.largeTitle.weight(.bold))
                        Text("Shared backend + local fallback ready")
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 24)

                    statRow

                    if let loadedAt = appState.loadedAt {
                        Text("Last sync: \(loadedAt.formatted(date: .omitted, time: .shortened))")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    if let error = appState.lastError {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                }
                .padding()
            }
            .navigationTitle("Home")
        }
    }

    private var statRow: some View {
        HStack(spacing: 12) {
            statCell(title: "Questions", value: "\(appState.questionCount)")
            statCell(title: "Pass", value: "70%")
            statCell(title: "Exam", value: "60 Q")
        }
    }

    private func statCell(title: String, value: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3.weight(.semibold))
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
