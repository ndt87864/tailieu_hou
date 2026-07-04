async function main() {
  try {
    const matchId = "7f420f50-cdf2-4eb2-8d45-f55ee3d67920";
    const qRes = await fetch(`http://localhost:3001/api/v1/questions/document/${matchId}`);
    const qData = await qRes.json();
    const questions = qData.questions || [];
    console.log(`Tổng số câu hỏi tải về: ${questions.length}`);
    
    const lockedCount = questions.filter(q => q.isPremiumLocked).length;
    console.log(`Số câu bị khóa premium: ${lockedCount}`);
    
    // Tìm các câu hỏi tương ứng trong DB
    const searchTexts = [
      "Ngành kinh tế chủ đạo của phần lớn các quốc gia phương Đông thời kì cổ đại là gì",
      "Nhà nước La Mã thời kì cổ đại đã thiết lập hình thức chính thể gì",
      "Bộ luật Hammurabi ở Lưỡng Hà cổ đại là bộ luật",
      "Trong các nhận định sau đây, nhận định nào ĐÚNG",
      "Trong các nhận định dưới dây, nhận định nào SAI",
      "Nhà nước Ai Cập cổ đại đã thiết lập hình thức chính thể gì",
      "Nhà nước Trung Quốc cổ đại thời kì Tây Chu thiết lập hình thức chính thể nhà nước gì"
    ];
    
    console.log("\n=== TÌM KIẾM CÂU HỎI TRONG DB ===");
    for (const text of searchTexts) {
      console.log(`\nTìm kiếm từ khóa: "${text}"`);
      const words = text.toLowerCase().split(/\s+/).slice(0, 5).join(" "); // Lấy 5 từ đầu
      
      const matches = questions.filter(q => {
        const qText = (q.question || "").toLowerCase();
        return qText.includes(words) || qText.includes(text.toLowerCase().substring(0, 30));
      });
      
      if (matches.length > 0) {
        console.log(`  -> Tìm thấy ${matches.length} câu tương ứng:`);
        matches.forEach((m, idx) => {
          console.log(`     [${idx}] DB Question: "${m.question}"`);
          console.log(`         Đáp án: "${m.answer}"`);
          console.log(`         Bị khóa: ${!!m.isPremiumLocked}`);
        });
      } else {
        console.log(`  -> KHÔNG tìm thấy câu nào tương tự.`);
      }
    }
  } catch (e) {
    console.error("Lỗi:", e);
  }
}

main();
