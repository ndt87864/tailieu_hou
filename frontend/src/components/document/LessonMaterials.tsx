import React from "react";
import { FileText, BookOpen, Download, Youtube, Play, Calendar } from "lucide-react";

export interface CrawlerResource {
  id: string;
  course_id: string;
  type: "file" | "youtube" | "announcement";
  title: string;
  content_url: string | null;
  raw_content: string | null;
  week_name: string;
  created_at: string;
}

export interface GroupedResource {
  weekName: string;
  files: CrawlerResource[];
  videos: CrawlerResource[];
}

interface LessonMaterialsProps {
  groupedResources: GroupedResource[];
  getEmbedUrl: (url: string) => string | null;
}

export const LessonMaterials: React.FC<LessonMaterialsProps> = ({
  groupedResources,
  getEmbedUrl,
}) => {
  if (groupedResources.length === 0) {
    return (
      <p className="text-xs text-[var(--muted)] py-6 text-center">
        Không có tài nguyên bài học nào cho các tuần đã chọn.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {groupedResources.map((group) => (
        <div key={group.weekName} className="lesson-week-group">
          <h4 className="lesson-week-group-title">
            <Calendar className="w-4 h-4 text-[var(--brand-600)]" />
            {group.weekName}
          </h4>

          {/* Slide & Tài liệu */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-[var(--fg-2)] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--brand-600)]" /> Slide & Tài liệu bài giảng
            </h5>
            {group.files.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                {group.files.map((res) => (
                  <div key={res.id} className="lesson-material-item">
                    <div className="lesson-material-left">
                      <BookOpen className="w-4 h-4 lesson-material-icon" />
                      <span className="lesson-material-name" title={res.title}>
                        {res.title}
                      </span>
                    </div>
                    {res.content_url && (
                      <a
                        href={res.content_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lesson-material-link"
                      >
                        <Download className="w-3.5 h-3.5" /> Xem/Tải
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)] pl-4 italic">
                Không có slide bài giảng cho tuần này.
              </p>
            )}
          </div>

          {/* Video bài học */}
          <div className="space-y-2 pt-2">
            <h5 className="text-xs font-semibold text-[var(--fg-2)] flex items-center gap-1.5">
              <Youtube className="w-3.5 h-3.5 text-red-500" /> Video bài học
            </h5>
            {group.videos.length > 0 ? (
              <div className="lesson-video-grid pl-4">
                {group.videos.map((res) => {
                  const embedUrl = res.content_url ? getEmbedUrl(res.content_url) : null;
                  return (
                    <div key={res.id} className="lesson-video-card">
                      {embedUrl ? (
                        <div className="lesson-video-iframe-wrapper">
                          <iframe
                            src={embedUrl}
                            title={res.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          ></iframe>
                        </div>
                      ) : (
                        <div className="h-28 bg-[var(--bg-3)] flex items-center justify-center">
                          <Play className="w-8 h-8 text-[var(--muted)]" />
                        </div>
                      )}
                      <a
                        href={res.content_url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="lesson-video-title"
                      >
                        {res.title}
                      </a>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)] pl-4 italic">
                Không có video bài giảng cho tuần này.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
