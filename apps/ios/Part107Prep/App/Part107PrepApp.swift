import SwiftUI

@main
struct Part107PrepApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environmentObject(appState)
                .task {
                    await appState.bootstrap()
                }
        }
    }
}

@MainActor
final class AppState: ObservableObject {
    @Published var questionCount: Int = 0
    @Published var lastError: String?
    @Published var loadedAt: Date?

    let config: AppConfig
    let repository: QuestionRepository
    let studyVM: StudySessionViewModel

    init(
        config: AppConfig = .fromEnvironment(),
        repository: QuestionRepository? = nil
    ) {
        self.config = config
        let repo = repository ?? QuestionRepository(config: config)
        self.repository = repo
        self.studyVM = StudySessionViewModel(repository: repo)
    }

    func bootstrap() async {
        await studyVM.loadInitialQuestions()
        questionCount = studyVM.availableQuestions.count
        loadedAt = Date()
        lastError = studyVM.errorMessage
    }
}

struct RootTabView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        TabView {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house")
                }

            StudyView(viewModel: appState.studyVM)
                .tabItem {
                    Label("Study", systemImage: "book")
                }

            ExamView()
                .tabItem {
                    Label("Exam", systemImage: "target")
                }

            ProgressView()
                .tabItem {
                    Label("Progress", systemImage: "chart.bar")
                }
        }
    }
}
