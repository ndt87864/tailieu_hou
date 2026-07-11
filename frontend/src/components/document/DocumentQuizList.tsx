import React from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { renderTextWithImages, findBestAnswerIndex, stripOptionPrefix } from "../../utils/questionHelper.js";

interface Question {
  id: string;
  question: string;
  choices: string[];
  answer: string;
  url_question: string | null;
  url_answer: string | null;
  url_choices: string | null;
  order_index: number;
  isPremiumLocked?: boolean;
}

interface DocumentQuizListProps {
  visibleQuestions: Question[];
  hasFullAccess: boolean;
  role: string;
}

export const DocumentQuizList: React.FC<DocumentQuizListProps> = ({
  visibleQuestions,
  hasFullAccess,
  role,
}) => {
  return (
    <>
      {/* Table view for Desktop & Tablet */}
      <div className="hidden md:block rounded-xl shadow-sm border overflow-x-auto doc-card-themed">
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
              {visibleQuestions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs doc-text-meta">
                    Không tìm thấy câu hỏi phù hợp.
                  </td>
                </tr>
              ) : (
                visibleQuestions.map((q, idx) => {
                  const isLocked = q.isPremiumLocked && !hasFullAccess;
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
                                  isCorrect && !isLocked
                                    ? "bg-green-500/10 text-green-600 font-medium border border-green-500/20" 
                                    : "doc-text-muted"
                                }`}
                                style={{ paddingLeft: isCorrect && !isLocked ? '0.5rem' : '0.25rem' }}
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
                        {isLocked ? (
                          <div className="flex flex-col gap-1.5 border rounded-lg p-2.5 max-w-xs doc-locked-card">
                            <span className="text-amber-600 font-bold text-xs flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" /> Bị khóa
                            </span>
                            {["pro", "plus"].includes(role) ? (
                              <span className="text-[10px] text-amber-600 font-semibold">
                                Vui lòng đăng ký
                              </span>
                            ) : (
                              <Link
                                to="/pricing"
                                className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-semibold px-2 py-1 rounded text-center transition"
                              >
                                Nâng cấp Premium
                              </Link>
                            )}
                          </div>
                        ) : (
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
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card view for Mobile */}
      <div className="block md:hidden space-y-4">
        {visibleQuestions.length === 0 ? (
          <div className="card p-8 text-center text-xs doc-empty-card">
            Không tìm thấy câu hỏi phù hợp.
          </div>
        ) : (
          visibleQuestions.map((q, idx) => {
            const isLocked = q.isPremiumLocked && !hasFullAccess;
            const allUrls = [q.url_question, q.url_choices, q.url_answer].filter(Boolean).join(",");
            return (
              <div key={q.id || idx} className="p-4 rounded-2xl border shadow-sm flex flex-col gap-3.5 bg-[var(--surface)] border-[var(--border-soft)] transition-all">
                <div className="flex items-center justify-between border-b border-dashed pb-2.5 border-[var(--border-soft)]">
                  <span className="font-bold text-xs text-[var(--brand-600)] uppercase tracking-wider">Câu {idx + 1}</span>
                  {isLocked && (
                    <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 border border-amber-500/20">
                      <Lock className="w-3.5 h-3.5" /> Premium
                    </span>
                  )}
                </div>
                
                <div className="text-sm font-semibold text-[var(--fg)] leading-relaxed">{renderTextWithImages(q.question, allUrls)}</div>
                
                {/* Choices list */}
                {q.choices && q.choices.length > 0 && (
                  <div className="space-y-2">
                    {(() => {
                      const bestIdx = findBestAnswerIndex(q.choices ?? [], q.answer);
                      return q.choices.map((opt, oIdx) => {
                        const isCorrect = oIdx === bestIdx;
                        return (
                          <div 
                            key={oIdx} 
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs border transition-colors ${
                              isCorrect && !isLocked
                                ? "bg-green-500/10 border-green-500/20 text-green-600 font-semibold"
                                : "bg-[var(--bg-2)] border-[var(--border-soft)] text-[var(--fg-2)] hover:bg-[var(--bg-3)]"
                            }`}
                          >
                            <span className={`font-bold shrink-0 ${isCorrect && !isLocked ? "text-green-600" : "text-[var(--brand-600)]"}`}>{String.fromCharCode(65 + oIdx)}.</span>
                            <span className="leading-relaxed">{renderTextWithImages(stripOptionPrefix(opt), allUrls)}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {q.url_question && !(/\.(?:png|jpe?g|gif|svg|webp|bmp)"?/i.test(q.question || "") || q.question.includes("pluginfile.php") || q.question.includes("@@PLUGINFILE@@")) && (
                  <div className="border rounded-xl p-1 max-w-full bg-[var(--bg-2)] border-[var(--border-soft)] overflow-hidden">
                    <img src={q.url_question} alt={`Ảnh câu hỏi ${idx + 1}`} className="max-h-48 w-full object-contain" />
                  </div>
                )}

                <div className="pt-1.5">
                  {isLocked ? (
                    ["pro", "plus"].includes(role) ? (
                      <div className="text-center text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 font-semibold py-2.5 rounded-xl">
                        Vui lòng đăng ký bộ câu hỏi này
                      </div>
                    ) : (
                      <Link
                        to="/pricing"
                        className="block text-center text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md"
                      >
                        Nâng cấp Premium để xem đáp án
                      </Link>
                    )
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Đáp án đúng</div>
                        <div className="text-sm font-semibold leading-relaxed">{renderTextWithImages(stripOptionPrefix(q.answer), allUrls)}</div>
                      </div>
                      {q.url_answer && !(/\.(?:png|jpe?g|gif|svg|webp|bmp)"?/i.test(q.answer || "") || q.answer.includes("pluginfile.php") || q.answer.includes("@@PLUGINFILE@@")) && (
                        <div className="border rounded-xl p-1 max-w-full bg-[var(--bg-2)] border-[var(--border-soft)] overflow-hidden">
                          <img src={q.url_answer} alt={`Ảnh đáp án ${idx + 1}`} className="max-h-48 w-full object-contain" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};
