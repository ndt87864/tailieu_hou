import React, { useState, useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import "../../css/filter-modal.css";

interface Category {
  id: string;
  title: string;
}

interface Document {
  id: string;
  title: string;
  category_id?: string | null;
}

interface FilterQuestionModalProps {
  show: boolean;
  onClose: () => void;
  categories: Category[];
  documents: Document[];
  selectedDocIds: string[];
  onApply: (selectedDocIds: string[]) => void;
}

const FilterQuestionModal: React.FC<FilterQuestionModalProps> = ({
  show,
  onClose,
  categories,
  documents,
  selectedDocIds,
  onApply,
}) => {
  const [categorySearch, setCategorySearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  
  const [tempSelectedCatIds, setTempSelectedCatIds] = useState<string[]>([]);
  const [tempSelectedDocIds, setTempSelectedDocIds] = useState<string[]>([]);

  const categoryInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Initialize temporary selections when modal opens
  useEffect(() => {
    if (show) {
      setTempSelectedDocIds(selectedDocIds);
      const catIds = documents
        .filter((d) => selectedDocIds.includes(d.id))
        .map((d) => d.category_id)
        .filter((id): id is string => !!id);
      setTempSelectedCatIds(Array.from(new Set(catIds)));
      setCategorySearch("");
      setDocumentSearch("");
    }
  }, [show, selectedDocIds, documents]);

  if (!show) return null;

  // Filter categories by search query
  const filteredCategories = categories.filter((cat) =>
    cat.title.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Get all documents belonging to currently checked categories
  const categoryDocuments = documents.filter(
    (doc) => doc.category_id && tempSelectedCatIds.includes(doc.category_id)
  );

  // Filter those category documents by search query
  const filteredDocuments = categoryDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(documentSearch.toLowerCase())
  );

  // Handle Category Checkbox Toggling
  const handleCategoryToggle = (categoryId: string, checked: boolean) => {
    let nextCatIds: string[];
    if (checked) {
      nextCatIds = [...tempSelectedCatIds, categoryId];
    } else {
      nextCatIds = tempSelectedCatIds.filter((id) => id !== categoryId);
    }
    setTempSelectedCatIds(nextCatIds);

    // Keep documents that belong to the remaining checked categories
    const remainingDocIds = tempSelectedDocIds.filter((docId) => {
      const doc = documents.find((d) => d.id === docId);
      return doc?.category_id && nextCatIds.includes(doc.category_id);
    });
    setTempSelectedDocIds(remainingDocIds);
  };

  // Toggle ALL visible/filtered categories
  const handleSelectAllCategories = () => {
    const allFilteredIds = filteredCategories.map((c) => c.id);
    const allSelected = allFilteredIds.every((id) =>
      tempSelectedCatIds.includes(id)
    );

    let nextCatIds: string[];
    if (allSelected) {
      // Uncheck all filtered categories
      nextCatIds = tempSelectedCatIds.filter(
        (id) => !allFilteredIds.includes(id)
      );
    } else {
      // Check all filtered categories
      nextCatIds = Array.from(
        new Set([...tempSelectedCatIds, ...allFilteredIds])
      );
    }
    setTempSelectedCatIds(nextCatIds);

    // Keep documents belonging to the remaining checked categories
    const remainingDocIds = tempSelectedDocIds.filter((docId) => {
      const doc = documents.find((d) => d.id === docId);
      return doc?.category_id && nextCatIds.includes(doc.category_id);
    });
    setTempSelectedDocIds(remainingDocIds);
  };

  // Handle Document Checkbox Toggling
  const handleDocumentToggle = (docId: string, checked: boolean) => {
    if (checked) {
      setTempSelectedDocIds([...tempSelectedDocIds, docId]);
    } else {
      setTempSelectedDocIds(tempSelectedDocIds.filter((id) => id !== docId));
    }
  };

  // Toggle ALL visible/filtered documents
  const handleSelectAllDocuments = () => {
    const allFilteredIds = filteredDocuments.map((d) => d.id);
    const allSelected = allFilteredIds.every((id) =>
      tempSelectedDocIds.includes(id)
    );

    let nextDocIds: string[];
    if (allSelected) {
      // Uncheck all filtered documents
      nextDocIds = tempSelectedDocIds.filter(
        (id) => !allFilteredIds.includes(id)
      );
    } else {
      // Check all filtered documents
      nextDocIds = Array.from(
        new Set([...tempSelectedDocIds, ...allFilteredIds])
      );
    }
    setTempSelectedDocIds(nextDocIds);
  };

  const handleClearAll = () => {
    setTempSelectedCatIds([]);
    setTempSelectedDocIds([]);
  };

  const handleApply = () => {
    onApply(tempSelectedDocIds);
  };

  return (
    <div className="filter-modal-backdrop" onClick={onClose}>
      <div
        className="filter-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="filter-modal-header">
          <h3 className="filter-modal-title">Lọc câu hỏi nâng cao</h3>
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
              {(tempSelectedCatIds.length > 0 ||
                tempSelectedDocIds.length > 0) && (
                <button
                  type="button"
                  className="filter-modal-clear-all-btn"
                  onClick={handleClearAll}
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            {/* Selected Categories */}
            <div>
              <h5 className="filter-modal-summary-section-title">
                Danh mục ({tempSelectedCatIds.length})
              </h5>
              {tempSelectedCatIds.length > 0 ? (
                <div className="filter-modal-summary-tags">
                  {tempSelectedCatIds.map((catId) => {
                    const cat = categories.find((c) => c.id === catId);
                    return (
                      <div key={catId} className="filter-modal-summary-tag">
                        <span className="filter-modal-summary-tag-text">
                          {cat?.title || "Không rõ"}
                        </span>
                        <button
                          type="button"
                          className="filter-modal-summary-tag-remove"
                          onClick={() => handleCategoryToggle(catId, false)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="filter-modal-summary-empty">Chưa chọn danh mục</p>
              )}
            </div>

            {/* Selected Documents */}
            <div>
              <h5 className="filter-modal-summary-section-title">
                Tài liệu ({tempSelectedDocIds.length})
              </h5>
              {tempSelectedDocIds.length > 0 ? (
                <div className="filter-modal-summary-tags">
                  {tempSelectedDocIds.map((docId) => {
                    const doc = documents.find((d) => d.id === docId);
                    return (
                      <div key={docId} className="filter-modal-summary-tag">
                        <span className="filter-modal-summary-tag-text">
                          {doc?.title || "Không rõ"}
                        </span>
                        <button
                          type="button"
                          className="filter-modal-summary-tag-remove"
                          onClick={() => handleDocumentToggle(docId, false)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="filter-modal-summary-empty">Chưa chọn tài liệu</p>
              )}
            </div>
          </div>

          {/* Right Column: Filters and lists */}
          <div className="filter-modal-selection-panel">
            {/* Category Search & List */}
            <div className="filter-modal-search-group">
              <label htmlFor="catSearch" className="filter-modal-search-label">
                Danh mục
              </label>
              <div className="filter-modal-search-input-wrapper">
                <Search className="filter-modal-search-icon w-4 h-4" />
                <input
                  ref={categoryInputRef}
                  id="catSearch"
                  type="text"
                  placeholder="Tìm kiếm danh mục..."
                  className="filter-modal-search-input"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                />
              </div>

              <div className="filter-modal-list-container">
                {filteredCategories.length > 0 ? (
                  <>
                    <div
                      className="filter-modal-list-header"
                      onClick={handleSelectAllCategories}
                    >
                      <input
                        type="checkbox"
                        className="filter-modal-checkbox"
                        checked={filteredCategories.every((c) =>
                          tempSelectedCatIds.includes(c.id)
                        )}
                        onChange={() => {}} // Handled by div onClick
                      />
                      <span>
                        {filteredCategories.every((c) =>
                          tempSelectedCatIds.includes(c.id)
                        )
                          ? "Bỏ chọn tất cả"
                          : "Chọn tất cả"}
                      </span>
                    </div>

                    {filteredCategories.map((c) => {
                      const isChecked = tempSelectedCatIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className={`filter-modal-item ${
                            isChecked ? "selected" : ""
                          }`}
                          onClick={() => handleCategoryToggle(c.id, !isChecked)}
                        >
                          <input
                            type="checkbox"
                            className="filter-modal-checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by div onClick
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
                    Không tìm thấy danh mục nào
                  </div>
                )}
              </div>
            </div>

            {/* Document Search & List */}
            <div className="filter-modal-search-group">
              <label htmlFor="docSearch" className="filter-modal-search-label">
                Tài liệu (Chọn danh mục để xem danh sách tài liệu)
              </label>
              <div className="filter-modal-search-input-wrapper">
                <Search className="filter-modal-search-icon w-4 h-4" />
                <input
                  ref={documentInputRef}
                  id="docSearch"
                  type="text"
                  placeholder={
                    tempSelectedCatIds.length > 0
                      ? "Tìm kiếm tài liệu..."
                      : "Vui lòng chọn ít nhất một danh mục ở trên..."
                  }
                  className="filter-modal-search-input"
                  value={documentSearch}
                  onChange={(e) => setDocumentSearch(e.target.value)}
                  disabled={tempSelectedCatIds.length === 0}
                />
              </div>

              <div className="filter-modal-list-container">
                {tempSelectedCatIds.length === 0 ? (
                  <div className="filter-modal-empty-msg">
                    Chưa chọn danh mục nào
                  </div>
                ) : filteredDocuments.length > 0 ? (
                  <>
                    <div
                      className="filter-modal-list-header"
                      onClick={handleSelectAllDocuments}
                    >
                      <input
                        type="checkbox"
                        className="filter-modal-checkbox"
                        checked={filteredDocuments.every((d) =>
                          tempSelectedDocIds.includes(d.id)
                        )}
                        onChange={() => {}} // Handled by div onClick
                      />
                      <span>
                        {filteredDocuments.every((d) =>
                          tempSelectedDocIds.includes(d.id)
                        )
                          ? "Bỏ chọn tất cả"
                          : "Chọn tất cả"}
                      </span>
                    </div>

                    {filteredDocuments.map((d) => {
                      const isChecked = tempSelectedDocIds.includes(d.id);
                      return (
                        <div
                          key={d.id}
                          className={`filter-modal-item ${
                            isChecked ? "selected" : ""
                          }`}
                          onClick={() => handleDocumentToggle(d.id, !isChecked)}
                        >
                          <input
                            type="checkbox"
                            className="filter-modal-checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by div onClick
                          />
                          <div className="flex-1">
                            <div className="filter-modal-item-title">
                              {d.title}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="filter-modal-empty-msg">
                    Không tìm thấy tài liệu nào
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
            disabled={tempSelectedDocIds.length === 0}
          >
            Áp dụng ({tempSelectedDocIds.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterQuestionModal;
