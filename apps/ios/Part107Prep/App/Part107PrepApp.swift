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
    @Published var authUserId: String?
    @Published var scoringSummary: ScoringSummaryResponse.Summary?
    @Published var syncStatus: String = "Not synced"

    let config: AppConfig
    let repository: QuestionRepository
    let apiClient: APIClient
    let studyVM: StudySessionViewModel

    private let studyDraftKey = "ios_study_draft_v1"

    init(
        config: AppConfig = .fromEnvironment(),
        repository: QuestionRepository? = nil,
        apiClient: APIClient? = nil
    ) {
        self.config = config
        let repo = repository ?? QuestionRepository(config: config)
        self.apiClient = apiClient ?? APIClient(config: config)
        self.repository = repo
        self.studyVM = StudySessionViewModel(repository: repo)
    }

    func bootstrap() async {
        await studyVM.loadInitialQuestions()
        questionCount = studyVM.availableQuestions.count
        loadedAt = Date()
        lastError = studyVM.errorMessage
        await refreshAuthSession()
        await hydrateDraftFromServerIfAvailable()
        await refreshScoringSummary()
    }

    func signInForDevelopment(userId: String) async {
        do {
            let session = try await apiClient.createDevSession(userId: userId)
            authUserId = session.userId
            syncStatus = session.authenticated ? "Authenticated as \(session.userId ?? userId)" : "Not authenticated"
            await hydrateDraftFromServerIfAvailable()
            await refreshScoringSummary()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func signOut() async {
        await apiClient.clearSessionToken()
        authUserId = nil
        scoringSummary = nil
        syncStatus = "Signed out"
    }

    func refreshAuthSession() async {
        do {
            let session = try await apiClient.getAuthSession()
            authUserId = session.userId
            if session.authenticated {
                syncStatus = "Authenticated as \(session.userId ?? "unknown")"
            } else {
                syncStatus = "Anonymous mode"
            }
        } catch {
            syncStatus = "Auth check failed"
        }
    }

    func persistStudyDraft() async {
        let draft = studyVM.snapshot()
        do {
            let encoded = try JSONEncoder().encode(draft)
            guard let json = String(data: encoded, encoding: .utf8) else {
                return
            }
            _ = try await apiClient.saveUserState(mode: "merge", data: [studyDraftKey: json])
            syncStatus = "Draft synced at \(Date().formatted(date: .omitted, time: .shortened))"
        } catch APIError.unauthorized {
            syncStatus = "Draft local only (not signed in)"
        } catch {
            lastError = error.localizedDescription
        }
    }

    func hydrateDraftFromServerIfAvailable() async {
        do {
            let state = try await apiClient.fetchUserState()
            guard let encoded = state.data?[studyDraftKey], !encoded.isEmpty else { return }
            guard let jsonData = encoded.data(using: .utf8) else { return }
            let snapshot = try JSONDecoder().decode(StudyDraftSnapshot.self, from: jsonData)
            studyVM.restore(from: snapshot)
            syncStatus = "Draft restored from cloud"
        } catch APIError.statusCode(let code) where code == 404 {
            syncStatus = authUserId == nil ? "Anonymous mode" : "No cloud draft yet"
        } catch APIError.unauthorized {
            syncStatus = "Anonymous mode"
        } catch {
            lastError = error.localizedDescription
        }
    }

    func trackAnswer(result: StudySessionViewModel.SubmitResult) async {
        let event = LearningEventPayload(
            id: UUID().uuidString,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            type: "answer_submitted",
            mode: "study",
            questionId: result.question.id,
            category: result.question.category.rawValue,
            subcategory: result.question.subcategory,
            isCorrect: result.isCorrect,
            questionTypeProfile: "confirmed_test",
            metadata: [
                "selectedOptionId": result.selectedOptionId,
                "correctOptionId": result.question.correctOptionId,
            ]
        )
        do {
            _ = try await apiClient.postLearningEvent(event)
        } catch APIError.unauthorized {
            // Anonymous flow is allowed; analytics sync resumes after auth.
        } catch {
            lastError = error.localizedDescription
        }
    }

    func refreshScoringSummary() async {
        do {
            let response = try await apiClient.fetchScoringSummary(window: "30d")
            scoringSummary = response.summary
        } catch APIError.unauthorized {
            scoringSummary = nil
        } catch {
            lastError = error.localizedDescription
        }
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
