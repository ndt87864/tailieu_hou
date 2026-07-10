import React, { useState, useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import "../../css/filter-modal.css";

interface Course {
  id: string;
  title: string;
}

interface FilterCrawlDataModalProps {
  show: boolean;
  onClose: () => void;
  courses: Course[];
  selectedCourseIds: string[];
  onApply: (selectedCourseIds: string[]) => void;
}

const FilterCrawlDataModal: React.FC<FilterCrawlDataModalProps> = ({
  show,
  onClose,
  courses,
  selectedCourseIds,
  onApply,
}) => {
  const [courseSearch, setCourseSearch] = useState("");
  const [tempSelectedCourseIds, setTempSelectedCourseIds] = useState<string[]>([]);
  const courseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      setTempSelectedCourseIds(selectedCourseIds);
      setCourseSearch("");
    }
  }, [show, selectedCourseIds]);

  if (!show) return null;

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const handleCourseToggle = (courseId: string, checked: boolean) => {
    if (checked) {
      setTempSelectedCourseIds([...tempSelectedCourseIds, courseId]);
    } else {
      setTempSelectedCourseIds(tempSelectedCourseIds.filter((id) => id !== courseId));
    }
  };

  const handleSelectAllCourses = () => {
    const allFilteredIds = filteredCourses.map((c) => c.id);
    const allSelected = allFilteredIds.every((id) => tempSelectedCourseIds.includes(id));

    if (allSelected) {
      setTempSelectedCourseIds(tempSelectedCourseIds.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setTempSelectedCourseIds(Array.from(new Set([...tempSelectedCourseIds, ...allFilteredIds])));
    }
  };

  const handleClearAll = () => {
    setTempSelectedCourseIds([]);
  };

  const handleApply = () => {
    onApply(tempSelectedCourseIds);
  };

  return (
    <div className="filter-modal-backdrop" onClick={onClose}>
      <div
        className="filter-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="filter-modal-header">
          <h3 className="filter-modal-title">Lọc theo môn học</h3>
          <button className="filter-modal-close-btn" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="filter-modal-body">
          {/* Left Column: Summary of selected items */}
          <div className="filter-modal-summary-panel">
            <div className="filter-modal-summary-header">
              <h4 className="filter-modal-summary-title">Đang chọn</h4>
              {tempSelectedCourseIds.length > 0 && (
                <button
                  type="button"
                  className="filter-modal-clear-all-btn"
                  onClick={handleClearAll}
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            <div>
              <h5 className="filter-modal-summary-section-title">
                Môn học ({tempSelectedCourseIds.length})
              </h5>
              {tempSelectedCourseIds.length > 0 ? (
                <div className="filter-modal-summary-tags">
                  {tempSelectedCourseIds.map((courseId) => {
                    const c = courses.find((x) => x.id === courseId);
                    return (
                      <div key={courseId} className="filter-modal-summary-tag">
                        <span className="filter-modal-summary-tag-text">
                          {c?.title || "Không rõ"}
                        </span>
                        <button
                          type="button"
                          className="filter-modal-summary-tag-remove"
                          onClick={() => handleCourseToggle(courseId, false)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="filter-modal-summary-empty">Chưa chọn môn học</p>
              )}
            </div>
          </div>

          {/* Right Column: Search and list */}
          <div className="filter-modal-selection-panel">
            <div className="filter-modal-search-group">
              <label htmlFor="courseSearch" className="filter-modal-search-label">
                Danh sách Môn học
              </label>
              <div className="filter-modal-search-input-wrapper">
                <Search className="filter-modal-search-icon w-4 h-4" />
                <input
                  ref={courseInputRef}
                  id="courseSearch"
                  type="text"
                  placeholder="Tìm kiếm môn học..."
                  className="filter-modal-search-input"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                />
              </div>

              <div className="filter-modal-list-container">
                {filteredCourses.length > 0 ? (
                  <>
                    <div
                      className="filter-modal-list-header"
                      onClick={handleSelectAllCourses}
                    >
                      <input
                        type="checkbox"
                        className="filter-modal-checkbox"
                        checked={filteredCourses.every((c) =>
                          tempSelectedCourseIds.includes(c.id)
                        )}
                        onChange={() => {}}
                      />
                      <span>
                        {filteredCourses.every((c) =>
                          tempSelectedCourseIds.includes(c.id)
                        )
                          ? "Bỏ chọn tất cả"
                          : "Chọn tất cả"}
                      </span>
                    </div>

                    {filteredCourses.map((c) => {
                      const isChecked = tempSelectedCourseIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className={`filter-modal-item ${
                            isChecked ? "selected" : ""
                          }`}
                          onClick={() => handleCourseToggle(c.id, !isChecked)}
                        >
                          <input
                            type="checkbox"
                            className="filter-modal-checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                          />
                          <span className="filter-modal-item-title">
                            {c.title}
                          </span>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="filter-modal-empty-msg">
                    Không tìm thấy môn học nào
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="filter-modal-footer">
          <button
            type="button"
            className="filter-modal-btn-cancel"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="filter-modal-btn-apply"
            onClick={handleApply}
            disabled={tempSelectedCourseIds.length === 0}
          >
            Áp dụng ({tempSelectedCourseIds.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterCrawlDataModal;
