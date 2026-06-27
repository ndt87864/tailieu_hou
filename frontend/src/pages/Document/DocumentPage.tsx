import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../../services/client.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import { Lock } from "lucide-react";

interface Question {
  id: string;
  question: string;
  choices: string[];
  answer: string;
  url_question: string | null;
  url_answer: string | null;
  order_index: number;
  isPremiumLocked?: boolean;
}

interface Document {
  id: string;
  title: string;
  description: string;
}

const DocumentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const [doc, setDoc] = useState<Document | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showAnswer, setShowAnswer] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!id) return;

    Promise.all([
      apiClient.get(`/api/v1/documents/${id}`),
      apiClient.get(`/api/v1/questions/document/${id}`),
    ])
      .then(([docRes, questRes]) => {
        setDoc(docRes.data.document);
        setQuestions(questRes.data.questions || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Lỗi tải thông tin tài liệu. Vui lòng thử lại.");
        setLoading(false);
      });
  }, [id]);

  const toggleAnswer = (idx: number) => {
    setShowAnswer((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (loading) return <LoadingSpinner />;
  if (error || !doc) return <div className="text-red-500 text-center p-8">{error || "Tài liệu không tồn tại."}</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-indigo-600">Trang chủ</Link> &gt; <span>{doc.title}</span>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{doc.title}</h1>
        <p className="text-gray-500 text-sm">{doc.description}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded font-medium">
            Quyền hiện tại của bạn: {role.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-lg font-bold text-gray-700">Danh sách câu hỏi ôn tập:</h2>
        {questions.length === 0 ? (
          <div className="text-center text-gray-400 py-8 bg-white rounded border border-dashed">
            Tài liệu này chưa có câu hỏi nào.
          </div>
        ) : (
          questions.map((q, idx) => {
            const isLocked = q.isPremiumLocked;
            const cleanAns = q.answer.trim().toLowerCase();

            return (
              <div
                key={q.id || idx}
                className={`bg-white p-5 rounded-lg shadow-sm border relative transition ${
                  isLocked ? "border-amber-200 bg-amber-50/10" : "border-gray-100"
                }`}
              >
                {isLocked && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg p-6 z-10 text-center">
                    <Lock className="w-8 h-8 text-amber-500 mb-2 animate-bounce" />
                    <h3 className="font-bold text-gray-800 text-sm mb-1">Nội dung trả phí bị khóa</h3>
                    <p className="text-xs text-gray-500 max-w-xs mb-3">
                      Bạn đang dùng tài khoản {role.toUpperCase()}. Vui lòng nâng cấp Premium để học trọn bộ {questions.length} câu hỏi.
                    </p>
                    <Link
                      to="/admin"
                      className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-1.5 rounded text-xs transition"
                    >
                      Nâng cấp Ngay (Trang Test)
                    </Link>
                  </div>
                )}

                <div className={isLocked ? "premium-blur" : ""}>
                  {/* Nội dung text & ảnh câu hỏi */}
                  <div className="font-semibold text-gray-800 mb-3 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs mt-0.5">
                        Câu {idx + 1}
                      </span>
                      <span>{q.question}</span>
                    </div>
                    {q.url_question && (
                      <div className="mt-2 max-w-lg border rounded p-1 bg-white">
                        <img
                          src={q.url_question}
                          alt={`Ảnh câu hỏi ${idx + 1}`}
                          className="max-h-60 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Lựa chọn trắc nghiệm */}
                  <div className="grid md:grid-cols-2 gap-3 pl-8">
                    {(q.choices || []).map((opt, oIdx) => {
                      const isCorrectText = showAnswer[idx] && opt.trim().toLowerCase() === cleanAns;
                      const isLetterCorrect = showAnswer[idx] &&
                        (cleanAns === "a" && oIdx === 0 ||
                         cleanAns === "b" && oIdx === 1 ||
                         cleanAns === "c" && oIdx === 2 ||
                         cleanAns === "d" && oIdx === 3);

                      return (
                        <div
                          key={oIdx}
                          className={`p-3 rounded border text-sm transition cursor-pointer ${
                            isCorrectText || isLetterCorrect
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-medium"
                              : "border-gray-100 hover:bg-gray-50"
                          }`}
                        >
                          <span className="font-bold mr-2">
                            {String.fromCharCode(65 + oIdx)}.
                          </span>
                          {opt}
                        </div>
                      );
                    })}
                  </div>

                  {/* Giải thích / Đáp án */}
                  <div className="mt-4 pt-3 border-t border-gray-50 flex flex-col gap-2">
                    <button
                      onClick={() => toggleAnswer(idx)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 self-start"
                    >
                      {showAnswer[idx] ? "Ẩn giải thích" : "Xem đáp án & giải thích"}
                    </button>

                    {showAnswer[idx] && (
                      <div className="bg-slate-50 p-3 rounded text-xs text-gray-600 border border-slate-100 flex flex-col gap-2">
                        <p className="font-bold text-slate-800">
                          Đáp án đúng: {q.answer}
                        </p>
                        {q.url_answer && (
                          <div className="my-1 max-w-lg border rounded p-1 bg-white">
                            <img
                              src={q.url_answer}
                              alt={`Ảnh đáp án ${idx + 1}`}
                              className="max-h-60 object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DocumentPage;
