// Part107Prep/Models/Question.swift
// Data models matching the shared JSON schema
// Used across iPhone, iPad, and macOS targets

import Foundation

// MARK: - Question Model

struct Question: Codable, Identifiable {
    let id: String
    let category: QuestionCategory
    let subcategory: String
    let questionText: String
    let figureReference: String?
    let options: [QuestionOption]
    let correctOptionId: String
    let explanationCorrect: String
    let explanationDistractors: [String: String]
    let citation: String
    let difficultyLevel: Int
    let acsCode: String?
    let tags: [String]
    let yearUpdated: Int?
    
    enum CodingKeys: String, CodingKey {
        case id, category, subcategory, options, citation, tags
        case questionText = "question_text"
        case figureReference = "figure_reference"
        case correctOptionId = "correct_option_id"
        case explanationCorrect = "explanation_correct"
        case explanationDistractors = "explanation_distractors"
        case difficultyLevel = "difficulty_level"
        case acsCode = "acs_code"
        case yearUpdated = "year_updated"
    }
}

struct QuestionOption: Codable, Identifiable {
    let id: String
    let text: String
}

// MARK: - Categories

enum QuestionCategory: String, Codable, CaseIterable, Identifiable {
    case regulations = "Regulations"
    case airspace = "Airspace"
    case weather = "Weather"
    case loadingPerformance = "Loading & Performance"
    case operations = "Operations"
    case emergencyProcedures = "Emergency Procedures"
    case crewResourceManagement = "Crew Resource Management"
    case radioCommunications = "Radio Communications"
    case airportOperations = "Airport Operations"
    case maintenancePreflight = "Maintenance & Preflight"
    case physiology = "Physiology"
    case remoteID = "Remote ID"
    
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .regulations: return "⚖️"
        case .airspace: return "🗺️"
        case .weather: return "🌤️"
        case .loadingPerformance: return "⚙️"
        case .operations: return "🛩️"
        case .emergencyProcedures: return "🚨"
        case .crewResourceManagement: return "👥"
        case .radioCommunications: return "📻"
        case .airportOperations: return "🛬"
        case .maintenancePreflight: return "🔧"
        case .physiology: return "🧠"
        case .remoteID: return "📡"
        }
    }
    
    var color: String {
        switch self {
        case .regulations: return "blue"
        case .airspace: return "purple"
        case .weather: return "cyan"
        case .loadingPerformance: return "yellow"
        case .operations: return "green"
        case .emergencyProcedures: return "red"
        case .crewResourceManagement: return "pink"
        case .radioCommunications: return "indigo"
        case .airportOperations: return "teal"
        case .maintenancePreflight: return "gray"
        case .physiology: return "rose"
        case .remoteID: return "sky"
        }
    }
}

// MARK: - Quiz Session

enum QuizMode {
    case study  // Instant feedback
    case exam   // Feedback at end only
}

struct UserAnswer {
    let questionId: String
    let selectedOptionId: String
    let isCorrect: Bool
    let timeSpentMs: Int
    var flaggedForReview: Bool
    let timestamp: Date
}

struct SessionResult {
    let sessionId: String
    let mode: QuizMode
    let totalQuestions: Int
    let correctCount: Int
    let incorrectCount: Int
    let unansweredCount: Int
    let scorePercent: Int
    let passed: Bool
    let totalTimeMs: Int
    let categoryBreakdown: [CategoryScore]
    let weakestCategories: [QuestionCategory]
    let flaggedQuestions: [String]
}

struct CategoryScore: Identifiable {
    let category: QuestionCategory
    let total: Int
    let correct: Int
    let percent: Int
    
    var id: String { category.rawValue }
}

// MARK: - Exam Constants

enum ExamConstants {
    static let totalQuestions = 60
    static let timeLimitMinutes = 120
    static let timeLimitMs = 120 * 60 * 1000
    static let passingPercent = 70
    static let passingCount = 42
}
