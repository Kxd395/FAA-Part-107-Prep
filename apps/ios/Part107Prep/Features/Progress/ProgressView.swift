import SwiftUI

struct ProgressView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "Progress Module",
                systemImage: "chart.bar",
                description: Text("Next slice: user-state sync + learning events ingestion against /api/user/* endpoints.")
            )
            .navigationTitle("Progress")
        }
    }
}
