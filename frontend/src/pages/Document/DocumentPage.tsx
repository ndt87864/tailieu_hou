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

  const toggleAnswer = (idx: number) =>
    setShowAnswer((prev) => ({ ...prev, [idx]: !prev[idx] }));

  if (loading) return <LoadingSpinner />;
  if (error || !doc)
    return (
      <div style={{ color: "#ef4444", textAlign: "center", padding: "2rem" }}>
        {error || "Tài liệu không tồn tại."}
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div style={{ color: "var(--muted)", fontSize: "0.875rem" }} className="mb-4">
        <Link to="/" style={{ color: "var(--muted)" }} className="hover:text-[var(--brand-600)] transition-colors">
          Trang chủ
        </Link>
        <span className="mx-1.5">&gt;</span>
        <span style={{ color: "var(--fg)" }}>{doc.title}</span>
      </div>

      {/* Doc header card */}
      <div className="card p-6 mb-6">
        <h1 style={{ color: "var(--fg)" }} className="text-2xl font-bold mb-2">{doc.title}</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>{doc.description}</p>
        <div className="mt-4 flex items-center gap-2">
          <span
            style={{
              background: "color-mix(in srgb, var(--brand-600) 10%, transparent)",
              color: "var(--brand-600)",
              fontSize: "0.75rem",
              fontWeight: 500,
              padding: "0.25rem 0.625rem",
              borderRadius: "0.375rem",
            }}
          >
            Quyền hiện tại của bạn: {role.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        <h2 style={{ color: "var(--fg)", fontWeight: 700, fontSize: "1.125rem" }}>
          Danh sách câu hỏi ôn tập:
        </h2>

        {questions.length === 0 ? (
          <div
            style={{ color: "var(--meta)", border: "1px dashed var(--border)", borderRadius: "0.75rem", background: "var(--surface)" }}
            className="text-center py-8"
          >
            Tài liệu này chưa có câu hỏi nào.
          </div>
        ) : (
          questions.map((q, idx) => {
            const isLocked = q.isPremiumLocked;
            const cleanAns = q.answer.trim().toLowerCase();

            return (
              <div
                key={q.id || idx}
                className="card relative"
                style={{
                  padding: "1.25rem",
                  borderColor: isLocked ? "#fbbf24" : undefined,
                }}
              >
                {isLocked && (
                  <div
                    style={{
                      position: "absolute", inset: 0,
                      background: "color-mix(in srgb, var(--surface) 80%, transparent)",
                      backdropFilter: "blur(3px)",
                      borderRadius: "inherit",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      zIndex: 10, textAlign: "center", padding: "1.5rem",
                    }}
                  >
                    <Lock className="w-8 h-8 text-amber-500 mb-2 animate-bounce" />
                    <h3 style={{ color: "var(--fg)", fontWeight: 700, fontSize: "0.875rem" }} className="mb-1">
                      Nội dung trả phí bị khóa
                    </h3>
                    <p style={{ color: "var(--muted)", fontSize: "0.75rem", maxWidth: "20rem" }} className="mb-3">
                      Bạn đang dùng tài khoản {role.toUpperCase()}. Vui lòng nâng cấp Premium để học trọn bộ {questions.length} câu hỏi.
                    </p>
                    <Link
                      to="/admin"
                      className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-1.5 rounded text-xs transition"
                    >
                      Nâng cấp Ngay
                    </Link>
                  </div>
                )}

                <div className={isLocked ? "premium-blur" : ""}>
                  {/* Câu hỏi */}
                  <div style={{ color: "var(--fg)", fontWeight: 600 }} className="mb-3 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <span
                        style={{ background: "var(--bg-2)", color: "var(--muted)", fontSize: "0.75rem", padding: "0.125rem 0.5rem", borderRadius: "0.375rem", marginTop: "0.125rem", whiteSpace: "nowrap" }}
                      >
                        Câu {idx + 1}
                      </span>
                      <span>{q.question}</span>
                    </div>
                    {q.url_question && (
                      <div style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.25rem", background: "var(--surface-2)" }} className="mt-2 max-w-lg">
                        <img src={q.url_question} alt={`Ảnh câu hỏi ${idx + 1}`} className="max-h-60 object-contain" />
                      </div>
                    )}
                  </div>

                  {/* Choices */}
                  <div className="grid md:grid-cols-2 gap-3 pl-8">
                    {(q.choices || []).map((opt, oIdx) => {
                      const isCorrectText = showAnswer[idx] && opt.trim().toLowerCase() === cleanAns;
                      const isLetterCorrect =
                        showAnswer[idx] &&
                        ((cleanAns === "a" && oIdx === 0) ||
                          (cleanAns === "b" && oIdx === 1) ||
                          (cleanAns === "c" && oIdx === 2) ||
                          (cleanAns === "d" && oIdx === 3));
                      const correct = isCorrectText || isLetterCorrect;

                      return (
                        <div
                          key={oIdx}
                          style={{
                            padding: "0.75rem",
                            borderRadius: "0.5rem",
                            border: `1px solid ${correct ? "#6ee7b7" : "var(--border)"}`,
                            background: correct ? "#ecfdf5" : "var(--surface-2)",
                            color: correct ? "#065f46" : "var(--fg)",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                            transition: "background 0.15s ease, border-color 0.15s ease",
                          }}
                        >
                          <span style={{ fontWeight: 700, marginRight: "0.5rem" }}>
                            {String.fromCharCode(65 + oIdx)}.
                          </span>
                          {opt}
                        </div>
                      );
                    })}
                  </div>

                  {/* Đáp án */}
                  <div style={{ borderTop: "1px solid var(--border-soft)", marginTop: "1rem", paddingTop: "0.75rem" }} className="flex flex-col gap-2">
                    <button
                      onClick={() => toggleAnswer(idx)}
                      style={{ color: "var(--brand-600)", fontSize: "0.75rem", fontWeight: 600, alignSelf: "flex-start" }}
                      className="hover:opacity-80 transition-opacity"
                    >
                      {showAnswer[idx] ? "Ẩn giải thích" : "Xem đáp án & giải thích"}
                    </button>

                    {showAnswer[idx] && (
                      <div
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.75rem", fontSize: "0.75rem", color: "var(--fg-2)" }}
                        className="flex flex-col gap-2"
                      >
                        <p style={{ fontWeight: 700, color: "var(--fg)" }}>Đáp án đúng: {q.answer}</p>
                        {q.url_answer && (
                          <div style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.25rem", background: "var(--surface)" }} className="my-1 max-w-lg">
                            <img src={q.url_answer} alt={`Ảnh đáp án ${idx + 1}`} className="max-h-60 object-contain" />
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
