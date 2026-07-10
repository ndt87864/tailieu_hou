import React from "react";
import { X, BookOpen, Calendar, Square, CheckSquare } from "lucide-react";

interface CrawlerCourse {
  id: string;
  document_id: string;
  moodle_course_id: string | null;
  title: string;
  url: string | null;
  created_at: string;
}

interface LessonFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: CrawlerCourse[];
  selectedCourseIds: string[];
  weeks: string[];
  selectedWeeks: string[];
  onApply: (courseIds: string[], weeks: string[]) => void;
}

export const LessonFilterModal: React.FC<LessonFilterModalProps> = ({
  isOpen,
  onClose,
  courses,
  selectedCourseIds,
  weeks,
  selectedWeeks,
  onApply,
}) => {
  if (!isOpen) return null;

  const [localCourseIds, setLocalCourseIds] = React.useState<string[]>(selectedCourseIds);
  const [localWeeks, setLocalWeeks] = React.useState<string[]>(selectedWeeks);

  React.useEffect(() => {
    setLocalCourseIds(selectedCourseIds);
    setLocalWeeks(selectedWeeks);
  }, [isOpen, selectedCourseIds, selectedWeeks]);

  const handleToggleCourse = (id: string) => {
    if (localCourseIds.includes(id)) {
      if (localCourseIds.length > 1) {
        setLocalCourseIds(localCourseIds.filter((x) => x !== id));
      }
    } else {
      setLocalCourseIds([...localCourseIds, id]);
    }
  };

  const handleToggleWeek = (week: string) => {
    if (localWeeks.includes(week)) {
      if (localWeeks.length > 1) {
        setLocalWeeks(localWeeks.filter((x) => x !== week));
      }
    } else {
      setLocalWeeks([...localWeeks, week]);
    }
  };

  const handleSelectAllCourses = () => {
    const allIds = courses.map((c) => c.id);
    if (localCourseIds.length === courses.length) {
      // Nếu đã chọn tất cả, đưa về chỉ chọn lớp đầu tiên để tránh rỗng
      if (courses.length > 0) {
        setLocalCourseIds([courses[0].id]);
      }
    } else {
      setLocalCourseIds(allIds);
    }
  };

  const handleSelectAllWeeks = () => {
    if (localWeeks.length === weeks.length) {
      // Nếu đã chọn tất cả, đưa về chỉ chọn tuần đầu tiên
      if (weeks.length > 0) {
        setLocalWeeks([weeks[0]]);
      }
    } else {
      setLocalWeeks([...weeks]);
    }
  };

  const handleSubmit = () => {
    onApply(localCourseIds, localWeeks);
    onClose();
  };

  return (
    <div className="lesson-filter-backdrop">
      <div className="lesson-filter-container">
        {/* Header */}
        <div className="lesson-filter-header">
          <div className="lesson-filter-header-title-wrapper">
            <span className="lesson-filter-header-icon">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h3 className="lesson-filter-header-title">Bộ lọc học tập</h3>
              <p className="lesson-filter-header-subtitle">Chọn lớp học & tuần học LMS</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="lesson-filter-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="lesson-filter-body">
          {/* Chọn lớp học (LMS Courses) */}
          {courses.length > 1 && (
            <div className="lesson-filter-section">
              <div className="flex justify-between items-center mb-1">
                <label className="lesson-filter-section-title">
                  Chọn lớp học LMS
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllCourses}
                  className="text-xs font-bold text-[var(--brand-600)] hover:underline cursor-pointer bg-transparent border-none"
                >
                  {localCourseIds.length === courses.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
              </div>
              <div className="lesson-filter-courses-grid">
                {courses.map((c) => {
                  const isSelected = localCourseIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleToggleCourse(c.id)}
                      className={`lesson-filter-btn${isSelected ? " lesson-filter-btn-selected" : ""}`}
                    >
                      <span className="truncate max-w-[85%]">{c.title}</span>
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[var(--brand-600)] flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-[var(--muted)] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chọn tuần học (Weeks) */}
          {weeks.length > 0 && (
            <div className="lesson-filter-section">
              <div className="flex justify-between items-center mb-1">
                <label className="lesson-filter-section-title">
                  Chọn tuần học
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllWeeks}
                  className="text-xs font-bold text-[var(--brand-600)] hover:underline cursor-pointer bg-transparent border-none"
                >
                  {localWeeks.length === weeks.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
              </div>
              <div className="lesson-filter-weeks-grid">
                {weeks.map((w) => {
                  const isSelected = localWeeks.includes(w);
                  const weekLabel = w.split(" - ")[0];
                  return (
                    <button
                      key={w}
                      onClick={() => handleToggleWeek(w)}
                      className={`lesson-filter-btn${isSelected ? " lesson-filter-btn-selected" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[var(--muted)]" />
                        <span>{weekLabel}</span>
                      </div>
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[var(--brand-600)] flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-[var(--muted)] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="lesson-filter-footer">
          <button
            onClick={handleSubmit}
            className="lesson-filter-submit-btn"
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );
};
