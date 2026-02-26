import Foundation

struct AuthSessionResponse: Codable {
    let authenticated: Bool
    let userId: String?
    let email: String?
    let displayName: String?
    let expiresInSeconds: Int?
}

struct UserStatePayload: Codable {
    let userId: String
    let data: [String: String]?
    let updatedAt: String?
}

struct UserStateSaveResponse: Codable {
    let userId: String
    let updatedAt: String
    let changedKeys: [String]
}

struct LearningEventPayload: Codable {
    let id: String
    let timestamp: String
    let type: String
    let mode: String
    let questionId: String?
    let category: String?
    let subcategory: String?
    let isCorrect: Bool?
    let questionTypeProfile: String?
    let metadata: [String: String]?
}

struct LearningEventEnvelope: Codable {
    let event: LearningEventPayload
}

struct LearningEventAcceptedResponse: Codable {
    let accepted: Bool
    let eventId: String
}

struct ScoringSummaryResponse: Codable {
    struct Summary: Codable {
        let answerCount: Int
        let correctCount: Int
        let firstAnswerAccuracyPercent: Int
        let finalAnswerAccuracyPercent: Int
        let confidenceCalibrationDelta: Double
    }

    let userId: String
    let window: String
    let generatedAt: String
    let summary: Summary
}

struct StudyDraftSnapshot: Codable {
    let category: String?
    let currentIndex: Int
    let selectedOptionId: String?
    let isAnswerSubmitted: Bool
    let correctCount: Int
    let attemptedCount: Int
    let updatedAt: String
}
