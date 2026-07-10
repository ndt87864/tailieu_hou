import React from "react";
import { Search, X, Download, CheckCircle2 } from "lucide-react";
import { findBestAnswerIndex, renderTextWithImages } from "../../utils/questionHelper.js";

export interface CrawlerQuestion {
  id: string;
  course_id: string;
  week_name: string;
  question: string;
  choices: string[];
  answer: string;
  url_question?: string | null;
  url_answer?: string | null;
  url_choices?: string | null;
  image_urls?: string[];
}

interface LessonQuizTabProps {
  currentQuestions: CrawlerQuestion[];
  filteredQuestions: CrawlerQuestion[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  exportAllToExcel: () => void;
}

export const LessonQuizTab: React.FC<LessonQuizTabProps> = ({
  currentQuestions,
  filteredQuestions,
  searchQuery,
  setSearchQuery,
  exportAllToExcel,
}) => {
  return (
    <div>
      {/* Toolbar: search + export */}
      <div className="lesson-quiz-toolbar">
        <div className="lesson-quiz-search-wrap">
          <Search className="lesson-quiz-search-icon w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Tìm kiếm câu hỏi, lựa chọn, đáp án..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="lesson-quiz-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="lesson-quiz-clear-btn">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {currentQuestions.length > 0 && (
          <div className="flex items-center justify-center md:justify-end gap-2 mt-4 md:mt-0 shrink-0">
            <button
              onClick={exportAllToExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-all cursor-pointer"
              title="Tải Excel toàn bộ câu hỏi của môn học"
            >
              <Download className="w-3.5 h-3.5" /> Tải Excel
            </button>
          </div>
        )}
      </div>

      {searchQuery && (
        <p className="text-xs text-[var(--muted)] mb-2">
          Tìm thấy <strong className="text-[var(--fg)]">{filteredQuestions.length}</strong> câu khớp với "{searchQuery}"
        </p>
      )}

      {filteredQuestions.length > 0 ? (
        <div className="lesson-quiz-scroll">
          {filteredQuestions.map((q, qIndex) => {
            const allUrls = [q.url_question, q.url_choices, q.url_answer].filter(Boolean).join(",");
            return (
              <div key={q.id} className="lesson-quiz-question-box">
                <div className="lesson-quiz-q-number">Câu {qIndex + 1}</div>
                <h5 className="lesson-quiz-question-title">
                  {renderTextWithImages(q.question, allUrls)}
                </h5>

                <div className="lesson-quiz-choices">
                  {(() => {
                    const bestIdx = findBestAnswerIndex(q.choices ?? [], q.answer);
                    return q.choices?.map((choice, cIndex) => {
                      const isCorrect = cIndex === bestIdx;
                      return (
                        <div
                          key={cIndex}
                          className={`lesson-quiz-choice-item${isCorrect ? " lesson-quiz-choice-correct" : ""}`}
                        >
                          <span className="font-bold shrink-0 w-5 text-[var(--muted)]">
                            {String.fromCharCode(65 + cIndex)}.
                          </span>
                          <span>{renderTextWithImages(choice, allUrls)}</span>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="lesson-quiz-answer-badge">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Đáp án: {renderTextWithImages(q.answer, allUrls)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)] py-6 text-center">
          {searchQuery ? "Không tìm thấy câu hỏi nào phù hợp." : "Không có câu hỏi LMS nào cho tuần này."}
        </p>
      )}
    </div>
  );
};
