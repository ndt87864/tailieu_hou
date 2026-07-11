import React from "react";
import { Search, X, Download, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { findBestAnswerIndex, renderTextWithImages, stripOptionPrefix } from "../../utils/questionHelper.js";

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
  isPremiumLocked?: boolean;
}

interface LessonQuizTabProps {
  currentQuestions: CrawlerQuestion[];
  filteredQuestions: CrawlerQuestion[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  exportAllToExcel: () => void;
  limitApplied?: boolean;
  totalCountBeforeLimit?: number;
}

export const LessonQuizTab: React.FC<LessonQuizTabProps> = ({
  currentQuestions,
  filteredQuestions,
  searchQuery,
  setSearchQuery,
  exportAllToExcel,
  limitApplied = false,
  totalCountBeforeLimit = 0,
}) => {
  const isActuallyLimited = limitApplied && filteredQuestions.length < totalCountBeforeLimit;

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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-2)] text-[var(--accent)] hover:bg-[var(--bg-3)] border border-[var(--border)] transition-all cursor-pointer"
              title="Tải Excel toàn bộ câu hỏi của môn học"
            >
              <Download className="w-3.5 h-3.5 text-[var(--accent)]" /> Tải Excel
            </button>
          </div>
        )}
      </div>

      {searchQuery && (
        <p className="text-xs text-[var(--muted)] mb-2">
          Tìm thấy <strong className="text-[var(--fg)]">{filteredQuestions.length}</strong> câu khớp với "{searchQuery}"
        </p>
      )}

      {filteredQuestions.length > 0 && (
        <p className="text-xs text-[var(--muted)] mb-3">
          Hiển thị từ 1 đến <strong className="text-[var(--fg)]">{filteredQuestions.length}</strong> trong tổng số <strong className="text-[var(--fg)]">{totalCountBeforeLimit || filteredQuestions.length}</strong> câu hỏi.
        </p>
      )}

      {filteredQuestions.length > 0 ? (
        <div className="lesson-quiz-scroll">
          {/* Table view for Desktop & Tablet */}
          <div className="hidden md:block rounded-xl shadow-sm border overflow-x-auto doc-card-themed mb-6">
            <div className="min-w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-xs font-semibold uppercase doc-surface-muted">
                    <th className="py-3 px-4 w-16 text-center">STT</th>
                    <th className="py-3 px-4">Câu hỏi</th>
                    <th className="py-3 px-4 w-1/3">Câu trả lời</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm doc-border-soft-text-fg2">
                  {filteredQuestions.map((q, idx) => {
                    const allUrls = [q.url_question, q.url_choices, q.url_answer].filter(Boolean).join(",");
                    const bestIdx = findBestAnswerIndex(q.choices ?? [], q.answer);
                    
                    return (
                      <tr key={q.id || idx} className="transition-colors hover:bg-[var(--bg-2)] doc-border-soft">
                        <td className="py-4 px-4 text-center font-medium text-xs align-top doc-text-meta">
                          {idx + 1}
                        </td>
                        <td className="py-4 px-4 align-top space-y-2">
                          <div className="font-medium doc-text-fg">{renderTextWithImages(q.question, allUrls)}</div>
                          
                          {/* Options choices list */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pl-2 border-l doc-border-themed">
                            {(q.choices || []).map((opt, oIdx) => {
                              const isCorrect = oIdx === bestIdx;
                              return (
                                <div 
                                  key={oIdx} 
                                  className={`text-xs p-1 rounded transition-colors ${
                                    isCorrect 
                                      ? "bg-green-500/10 text-green-600 font-medium border border-green-500/20" 
                                      : "doc-text-muted"
                                  }`}
                                  style={{ paddingLeft: isCorrect ? '0.5rem' : '0.25rem' }}
                                >
                                  <span className="font-semibold mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                                  {renderTextWithImages(stripOptionPrefix(opt), allUrls)}
                                </div>
                              );
                            })}
                          </div>

                          {q.url_question && !(/\.(?:png|jpe?g|gif|svg|webp|bmp)"?/i.test(q.question || "") || (q.question || "").includes("pluginfile.php") || (q.question || "").includes("@@PLUGINFILE@@")) && (
                            <div className="mt-2 border rounded-lg p-1 max-w-sm inline-block doc-option-card">
                              <img src={q.url_question} alt={`Ảnh câu hỏi ${idx + 1}`} className="max-h-40 object-contain" />
                            </div>
                          )}
                        </td>
                         <td className="py-4 px-4 align-top">
                           <div className="space-y-1.5">
                             <div className="font-semibold rounded-lg px-2.5 py-1.5 text-xs border doc-answer-badge bg-green-500/10 text-green-600 border-green-500/20 w-full block">
                               {renderTextWithImages(stripOptionPrefix(q.answer), allUrls)}
                             </div>
                             {q.url_answer && !(/\.(?:png|jpe?g|gif|svg|webp|bmp)"?/i.test(q.answer || "") || (q.answer || "").includes("pluginfile.php") || (q.answer || "").includes("@@PLUGINFILE@@")) && (
                               <div className="border rounded-lg p-1 max-w-xs doc-option-card">
                                 <img src={q.url_answer} alt={`Ảnh đáp án ${idx + 1}`} className="max-h-40 object-contain" />
                               </div>
                             )}
                           </div>
                         </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card view for Mobile */}
          <div className="block md:hidden space-y-4">
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
                            <span>{renderTextWithImages(stripOptionPrefix(choice), allUrls)}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="lesson-quiz-answer-badge">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Đáp án: {renderTextWithImages(stripOptionPrefix(q.answer), allUrls)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {isActuallyLimited && (
            <div className="flex flex-col items-center justify-center gap-2 border border-dashed rounded-xl p-6 mt-4 bg-amber-500/5 border-amber-500/20 text-center">
              <Lock className="w-5 h-5 text-amber-500" />
              <h6 className="font-bold text-sm text-[var(--fg)]">Các câu hỏi còn lại đã bị khóa</h6>
              <p className="text-xs text-[var(--muted)] max-w-sm">
                Tài khoản của bạn bị giới hạn xem câu hỏi của môn học này. Hãy nâng cấp gói Premium để mở khóa không giới hạn.
              </p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg transition mt-2"
              >
                <span>Nâng cấp Premium</span> <Sparkles className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)] py-6 text-center">
          {searchQuery ? "Không tìm thấy câu hỏi nào phù hợp." : "Không có câu hỏi LMS nào cho tuần này."}
        </p>
      )}
    </div>
  );
};
