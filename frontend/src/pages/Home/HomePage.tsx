import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../services/client.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";

interface Document {
  id: string;
  title: string;
  description: string;
  category_id: string;
  created_at: string;
}

const HomePage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/api/v1/documents")
      .then((res) => {
        setDocuments(res.data.documents || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Không thể tải danh sách tài liệu.");
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📚 Kho Tài Liệu HOU</h1>
        <p className="text-gray-500 text-sm">Chọn một tài liệu/đề thi bên dưới để bắt đầu ôn tập.</p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center text-gray-500 p-8">Chưa có tài liệu nào trên hệ thống.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">{doc.title}</h3>
                <p className="text-gray-500 text-sm line-clamp-3 mb-4">{doc.description}</p>
              </div>
              <Link
                to={`/documents/${doc.id}`}
                className="block text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium py-2 rounded-md transition"
              >
                Vào ôn thi
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;
