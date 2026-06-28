import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { supabase } from "../../context/AuthContext.js";
import { pushToRegistrationQueue } from "../../services/examScheduleService.js";
import qrCodeImg from "./qrcode.jpg";

interface ProxyRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentData: any;
  results: any[];
  rentedIds: (string | number)[];
  rentedBillUrls: string;
  subjectPriceMap: Record<string, number>;
  setRentedIds: (ids: (string | number)[]) => void;
  setRentedBillUrls: (urls: string) => void;
  setRegistrationStatus: (status: string | null) => void;
  isDarkMode: boolean;
  themeVariables: React.CSSProperties;
}

const ProxyRegistrationModal: React.FC<ProxyRegistrationModalProps> = ({
  isOpen,
  onClose,
  studentData,
  results,
  rentedIds,
  rentedBillUrls,
  subjectPriceMap,
  setRentedIds,
  setRentedBillUrls,
  setRegistrationStatus,
  isDarkMode,
  themeVariables,
}) => {
  const [proxyStep, setProxyStep] = useState(0);
  const [selectedSubjects, setSelectedSubjects] = useState<any[]>([]);
  const [billImage, setBillImage] = useState<string | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billUrl, setBillUrl] = useState("");
  const [visitedLinks, setVisitedLinks] = useState<Record<string | number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const style = document.createElement("style");
      style.id = "proxy-modal-hide-globals";
      style.innerHTML = `button[aria-label="Hiển thị lịch"], .zalo-contact-wrapper, div.fixed.bottom-6.right-6.z-50 { display: none !important; }`;
      document.head.appendChild(style);
      
      const eligible = results.filter((row) => {
        const raw = (row.status || "").toString().trim().toLowerCase();
        const hasLink = row.examLink && row.examLink.trim() !== "";
        const isEligible = raw === "eligible" || row.status === "Đủ điều kiện" || raw === "unverified" || row.status === "Thi lại" || row.status === "Thi cải thiện";
        return isEligible && hasLink;
      });
      const available = eligible.filter((sub) => !rentedIds.includes(sub.id));
      
      if (eligible.length > 0 && available.length === 0) {
        setProxyStep(4);
      } else {
        setProxyStep(1);
      }
    } else {
      document.body.style.overflow = "unset";
      const styleTag = document.getElementById("proxy-modal-hide-globals");
      if (styleTag) styleTag.remove();
      setProxyStep(0);
    }

    return () => {
      document.body.style.overflow = "unset";
      const styleTag = document.getElementById("proxy-modal-hide-globals");
      if (styleTag) styleTag.remove();
    };
  }, [isOpen, results, rentedIds]);

  if (!isOpen || proxyStep === 0) return null;

  const eligibleSubjects = results.filter((row) => {
    const raw = (row.status || "").toString().trim().toLowerCase();
    const hasLink = row.examLink && row.examLink.trim() !== "";
    const isEligible = raw === "eligible" || row.status === "Đủ điều kiện" || raw === "unverified" || row.status === "Thi lại" || row.status === "Thi cải thiện";
    return isEligible && hasLink;
  });

  const availableToRent = eligibleSubjects.filter((sub) => !rentedIds.includes(sub.id));

  const handleDownloadQR = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `QR_THANHTOAN_${studentData.studentId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Đang tải mã QR về máy...");
    } catch (err) {
      toast.error("Không thể tải mã QR, vui lòng chụp màn hình.");
    }
  };

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Đã sao chép nội dung chuyển khoản!");
    setTimeout(() => setCopied(false), 3000);
  };

  const toggleSubject = (sub: any) => {
    setSelectedSubjects((prev) =>
      prev.find((s) => s.id === sub.id) ? prev.filter((s) => s.id !== sub.id) : [...prev, sub]
    );
  };

  const selectAll = () => {
    setSelectedSubjects(selectedSubjects.length === availableToRent.length ? [] : availableToRent);
  };

  const handleLinkClick = (id: string | number) => {
    setVisitedLinks((prev) => ({ ...prev, [id]: true }));
  };

  const handleConfirmBillAndSave = async () => {
    if (finalizing) return;
    if (!billFile) {
      toast.error("Vui lòng chọn ảnh bill trước.");
      return;
    }

    setFinalizing(true);
    const processingToastId = toast.info("Đang gửi thông tin lên hệ thống, vui lòng chờ trong giây lát...", { autoClose: false });
    try {
      let finalBillUrl = billUrl;

      if (billFile) {
        const fileExt = billFile.name.split(".").pop();
        const fileName = `${studentData.studentId}_${Date.now()}.${fileExt}`;
        const filePath = `bills/${fileName}`;

        const { error: storageError } = await supabase.storage
          .from("tailieuehou")
          .upload(filePath, billFile);

        if (storageError) throw storageError;

        const { data: { publicUrl } } = supabase.storage
          .from("tailieuehou")
          .getPublicUrl(filePath);

        finalBillUrl = publicUrl;
      }

      const currentSessionIds = selectedSubjects.map((s) => s.id);
      const allFinalIds = [...new Set([...rentedIds, ...currentSessionIds])];
      const totalQuantity = allFinalIds.length;

      const totalAmount = selectedSubjects.reduce((sum, s) => {
        const subjectKey = s.subject?.trim() || s.subject;
        const price = subjectPriceMap[subjectKey] ?? subjectPriceMap[s.subject] ?? 100000;
        return sum + (Number(price) || 0);
      }, 0);

      const updatedBillUrls = rentedBillUrls
        ? `${rentedBillUrls},${finalBillUrl}`
        : finalBillUrl;

      const { success, error: queueError } = await pushToRegistrationQueue({
        studentId: studentData.studentId,
        selectedIds: allFinalIds,
        fullName: studentData.fullName,
        username: studentData.username,
        billUrl: updatedBillUrls,
        quantity: totalQuantity,
        totalAmount: totalAmount,
      });

      if (!success) throw new Error(queueError);

      setRegistrationStatus("pending");
      setRentedIds(allFinalIds);
      setRentedBillUrls(updatedBillUrls);
      setBillUrl(finalBillUrl);

      toast.success("Hệ thống đã tiếp nhận Bill và đang xử lý tự động. Bạn có thể đóng tab này!");
      setProxyStep(4);
    } catch (err) {
      console.error("Finalize Error:", err);
      toast.error("Không kết nối được đến máy chủ. Vui lòng thử lại.");
    } finally {
      setFinalizing(false);
      toast.dismiss(processingToastId);
    }
  };

  const totalAmountToPay = selectedSubjects.reduce((sum, s) => {
    const subjectKey = s.subject?.trim() || s.subject;
    return sum + (subjectPriceMap[subjectKey] ?? subjectPriceMap[s.subject] ?? 100000);
  }, 0);

  const allLinksVisited =
    selectedSubjects.length > 0 &&
    selectedSubjects.every((sub) => !sub.examLink || visitedLinks[sub.id]);

  const activeSubjectsList = selectedSubjects.length > 0
    ? selectedSubjects
    : eligibleSubjects.filter((sub) => rentedIds.includes(sub.id));

  return createPortal(
    <div className="lt-modal-overlay" style={themeVariables}>
      <div className={`lt-modal-container ${isDarkMode ? "dark" : ""}`}>
        {/* Header */}
        <div className="lt-modal-header">
          <h2 className="lt-modal-header-title">
            <span className="p-2 lt-glass-icon rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </span>
            <span className="lt-modal-header-text">
              {proxyStep === 1 ? "Chọn môn học" : proxyStep === 2 ? "Thanh toán" : proxyStep === 3 ? "Gửi ảnh bill" : "Hoàn tất quy trình"}
            </span>
          </h2>
          <button className="lt-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div className="lt-modal-body">
          {proxyStep === 1 && (
            <div className="flex flex-col gap-[14px]">
              <div className="flex justify-between items-center mb-[6px]">
                <span className="lt-modal-body-kicker">Môn đủ ĐK & có link phòng</span>
                {availableToRent.length > 0 && (
                  <button onClick={selectAll} className="lt-pill cursor-pointer border-none font-bold">
                    {selectedSubjects.length === availableToRent.length ? "BỎ CHỌN HẾT" : "CHỌN TẤT CẢ"}
                  </button>
                )}
              </div>
              {eligibleSubjects.map((sub) => {
                const isRented = rentedIds.includes(sub.id);
                const subjectKey = sub.subject?.trim() || sub.subject;
                const price = subjectPriceMap[subjectKey] ?? subjectPriceMap[sub.subject] ?? 100000;
                const priceDisplay = (price / 1000).toFixed(0) + "k";
                const isSelected = !!selectedSubjects.find((s) => s.id === sub.id);
                return (
                  <label
                    key={sub.id}
                    className={`lt-modal-subject-card ${isRented ? "rented" : ""} ${isSelected ? "selected" : ""}`}
                  >
                    {isRented ? (
                      <div className="lt-modal-checkbox-placeholder">
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSubject(sub)}
                        className="lt-modal-checkbox"
                      />
                    )}
                    <div className="flex-1">
                      <div className="lt-modal-subject-name">{sub.subject}</div>
                      <div className="lt-modal-subject-meta">
                        {sub.examDate} • PHÒNG {sub.examRoom}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-[6px]">
                      <div className={`lt-modal-subject-price ${isRented ? "rented" : ""}`}>
                        {isRented ? "Đã đăng kí" : priceDisplay}
                      </div>
                      {isRented && sub.examLink && !visitedLinks[sub.id] && (
                        <a
                          href={sub.examLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLinkClick(sub.id);
                          }}
                          className="lt-search-btn lt-modal-zalo-btn"
                        >
                          VÀO ZALO
                        </a>
                      )}
                      {isRented && visitedLinks[sub.id] && (
                        <span className="lt-modal-joined-badge">✓ Đã vào nhóm</span>
                      )}
                    </div>
                  </label>
                );
              })}

              {selectedSubjects.length > 0 && (
                <button
                  onClick={() => setProxyStep(2)}
                  className="lt-search-btn w-full py-5 mt-4 font-bold uppercase shadow-2xl rounded-2xl"
                >
                  Tiếp tục thanh toán ({totalAmountToPay.toLocaleString()}đ)
                </button>
              )}
            </div>
          )}

          {proxyStep === 2 && (
            <div className="text-center flex flex-col gap-6">
              <div className="flex flex-col items-center gap-[15px]">
                <div className="lt-modal-qr-wrapper">
                  <img id="payment-qr-code" src={qrCodeImg} alt="QR" className="lt-modal-qr-image" />
                </div>
                <button onClick={() => handleDownloadQR(qrCodeImg)} className="lt-pill lt-modal-qr-download-btn">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Lưu mã QR về máy</span>
                </button>
              </div>
              <div>
                <div className="lt-modal-pay-label">Tổng số tiền cần thanh toán</div>
                <div className="lt-modal-pay-amount">{totalAmountToPay.toLocaleString()}đ</div>
                <div
                  onClick={() =>
                    handleCopyContent(
                      `${studentData.studentId} ${studentData.username} ${studentData.fullName} ${selectedSubjects.length} MON`
                    )
                  }
                  className={`lt-modal-copy-box ${copied ? "copied" : ""}`}
                  title="Chạm để sao chép"
                >
                  <div className="lt-modal-copy-box-label">
                    {copied ? "ĐÃ COPY NỘI DUNG! ✅" : "NỘI DUNG CHUYỂN KHOẢN (BẤM ĐỂ COPY)"}
                  </div>
                  <div className="lt-modal-copy-box-content">
                    <span>
                      {studentData.studentId} {studentData.username} {studentData.fullName} {selectedSubjects.length} MON
                    </span>
                    {!copied && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setProxyStep(3)} className="lt-search-btn w-full py-5 font-bold uppercase rounded-[20px] text-base">
                Xác nhận đã chuyển khoản
              </button>
              <button onClick={() => setProxyStep(1)} className="lt-modal-back-btn">
                QUAY LẠI CHỌN MÔN
              </button>
            </div>
          )}

          {proxyStep === 3 && (
            <div className="text-center flex flex-col gap-6">
              <div>
                <h3 className="lt-modal-step3-title">Gửi Ảnh Bill</h3>
                <p className="lt-modal-step3-desc">Hệ thống sẽ duyệt ngay sau khi nhận bill</p>
              </div>
              <div className="lt-modal-bill-upload-box">
                {billImage ? (
                  <div className="w-full h-full p-[15px] relative">
                    <img src={billImage} alt="Bill" className="w-full h-full object-contain" />
                    <button
                      onClick={() => {
                        setBillImage(null);
                        setBillFile(null);
                      }}
                      className="lt-modal-bill-delete-btn"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-[48px] opacity-80">📸</div>
                    <span className="font-bold text-sm text-[var(--theme-primary)]">CHẠM CHỌN ẢNH BILL</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    try {
                      const file = e.target.files?.[0];
                      if (file) {
                        setBillFile(file);
                        setBillImage(URL.createObjectURL(file));
                      }
                    } catch (err) {
                      console.error("File selection error:", err);
                    }
                  }}
                />
              </div>
              <button
                disabled={!billImage || finalizing}
                onClick={handleConfirmBillAndSave}
                className="lt-search-btn w-full py-5 font-bold uppercase shadow-lg rounded-[20px]"
                style={{ opacity: billImage && !finalizing ? 1 : 0.5 }}
              >
                {finalizing ? "ĐANG LƯU..." : "XÁC NHẬN ĐÃ CHUYỂN KHOẢN"}
              </button>
            </div>
          )}

          {proxyStep === 4 && (
            <div className="flex flex-col gap-5">
              <div className="lt-modal-success-box">
                ĐÃ LƯU THÀNH CÔNG - VÀO NHÓM ĐỂ HOÀN TẤT
              </div>
              <div className="flex flex-col gap-3">
                {activeSubjectsList.map((sub) => (
                  <div key={sub.id} className="lt-modal-zalo-row">
                    <div className="flex-1">
                      <div className="font-bold text-[14px] text-[var(--theme-primary)]">{sub.subject}</div>
                      <div className="text-[10px] opacity-50 mt-[6px] font-bold uppercase">
                        {sub.examDate} | PHÒNG {sub.examRoom}
                      </div>
                    </div>
                    {sub.examLink && (
                      <a
                        href={sub.examLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick(sub.id)}
                        className={`lt-modal-zalo-btn-link ${visitedLinks[sub.id] ? "visited" : "lt-search-btn"}`}
                      >
                        {visitedLinks[sub.id] ? "ĐÃ VÀO" : "VÀO ZALO"}
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  onClose();
                  setSelectedSubjects([]);
                  setBillFile(null);
                  setBillImage(null);
                }}
                className={`w-full py-5 font-bold uppercase shadow-2xl rounded-2xl transition-all lt-search-btn cursor-pointer ${
                  allLinksVisited ? "success" : "neutral"
                }`}
              >
                {allLinksVisited ? "HOÀN TẤT & ĐÓNG CỬA SỔ" : "ĐÓNG CỬA SỔ (CÓ THỂ VÀO NHÓM SAU)"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProxyRegistrationModal;
