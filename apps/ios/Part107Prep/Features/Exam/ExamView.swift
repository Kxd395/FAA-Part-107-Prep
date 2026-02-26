import SwiftUI

struct ExamView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "Exam Module",
                systemImage: "target",
                description: Text("Foundation scaffold is in place. Next slice: timed exam session + review pass + scoring summary parity with web.")
            )
            .navigationTitle("Exam")
            .foregroundStyle(BrandColor.textPrimary)
            .brandScreen()
        }
    }
}
