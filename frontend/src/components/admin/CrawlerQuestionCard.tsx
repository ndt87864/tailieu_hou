import React from "react";
import { Edit2, Trash2 } from "lucide-react";
import { renderTextWithImages, isAnswerMatching } from "../../utils/questionHelper.js";

export interface CrawlerQuestion {
  id: string;
  course_id: string;
  week_name?: string;
  question: string;
  answer: string;
  choices?: string[];
  url_question?: string;
  url_answer?: string;
  url_choices?: string;
  course?: { title: string, document_id: string };
}

interface CrawlerQuestionCardProps {
  q: CrawlerQuestion;
  displayIndex: number;
  selectedQuestionIds: string[];
  toggleSelectQuestion: (id: string) => void;
  handleEditClick: (q: CrawlerQuestion) => void;
  handleDelete: (id: string) => void;
}

const CrawlerQuestionCard: React.FC<CrawlerQuestionCardProps> = ({
  q,
  displayIndex,
  selectedQuestionIds,
  toggleSelectQuestion,
  handleEditClick,
  handleDelete,
}) => {
  return (
    <div className={`relative group flex items-start gap-3 rounded-xl border transition-all duration-200 p-4
      ${selectedQuestionIds.includes(q.id)
        ? "border-brand-400 bg-brand-50/60 dark:bg-brand-900/10 dark:border-brand-600"
        : "border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm"
      }
    `}>
      <input
        type="checkbox"
        checked={selectedQuestionIds.includes(q.id)}
        onChange={() => toggleSelectQuestion(q.id)}
        className="mt-1 w-4 h-4 rounded cursor-pointer shrink-0"
      />

      <div className="flex-1 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="q-label">Câu hỏi #{displayIndex}</span>
              {q.course?.title && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                  {q.course.title} {q.week_name ? `- ${q.week_name}` : ""}
                </span>
              )}
            </div>
            <h4 className="q-title font-semibold text-sm">
              {renderTextWithImages(q.question, q.url_question)}
            </h4>
            {q.url_question && !q.question.includes("pluginfile.php") && (
              <div className="mt-2 border rounded-lg p-1 max-w-sm inline-block bg-[var(--bg-2)] border-[var(--border-soft)]">
                <img src={q.url_question} alt="Ảnh câu hỏi" className="max-h-32 object-contain" />
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => handleEditClick(q)}
              className="btn-icon-edit p-1.5 hover:bg-[var(--bg-2)] rounded-lg transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(q.id)}
              className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Choices list */}
        {Array.isArray(q.choices) && q.choices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs py-1">
            {q.choices.map((choice, i) => (
              <div
                key={i}
                className={`px-3 py-2 rounded-lg border flex items-center gap-2 choice-item ${
                  isAnswerMatching(choice, q.answer) ? "choice-correct" : "choice-neutral"
                }`}
              >
                <span
                  className={`choice-badge font-bold flex items-center justify-center w-5 h-5 rounded-full ${
                    isAnswerMatching(choice, q.answer) ? "choice-badge-correct" : "choice-badge-neutral"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className={isAnswerMatching(choice, q.answer) ? "choice-text-correct" : "choice-text-neutral"}>
                  {renderTextWithImages(choice, q.url_choices)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Answer if not in choices */}
        {(!Array.isArray(q.choices) || q.choices.length === 0) && q.answer && (
          <div className="text-xs p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 space-y-2">
            <div>
              <strong>Đáp án:</strong> {renderTextWithImages(q.answer, q.url_answer)}
            </div>
            {q.url_answer && (
              <div className="mt-2 border rounded-lg p-1 max-w-sm inline-block bg-[var(--bg-2)] border-[var(--border-soft)]">
                <img src={q.url_answer} alt="Ảnh đáp án" className="max-h-32 object-contain" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CrawlerQuestionCard;
