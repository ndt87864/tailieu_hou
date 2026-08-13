const fs = require('fs');
const path = require('path');

const coreDistDir = path.resolve(__dirname, '../../node_modules/@fortune-sheet/core/dist');
const filesToPatch = ['index.esm.js', 'index.js'];

const translations = {
  "Undo": "Hoàn tác",
  "Redo": "Làm lại",
  "Format Painter": "Sao chép định dạng",
  "Clear Format": "Xóa định dạng",
  "Font": "Phông chữ",
  "Font Size": "Cỡ chữ",
  "Bold": "In đậm",
  "Italic": "In nghiêng",
  "Strikethrough": "Gạch ngang",
  "Underline": "Gạch chân",
  "Text color": "Màu chữ",
  "Background color": "Màu nền",
  "Horizontal align": "Căn ngang",
  "Vertical align": "Căn dọc",
  "Text Wrap": "Ngắt dòng",
  "Merge": "Gộp ô",
  "Merge all": "Gộp tất cả",
  "Merge horizontal": "Gộp ngang",
  "Merge vertical": "Gộp dọc",
  "Unmerge": "Bỏ gộp",
  "Copy": "Sao chép",
  "Paste": "Dán",
  "Cut": "Cắt",
  "Insert row": "Chèn dòng",
  "Insert column": "Chèn cột",
  "Delete row": "Xóa dòng",
  "Delete column": "Xóa cột",
  "Hide row": "Ẩn dòng",
  "Hide column": "Ẩn cột",
  "Clear": "Xóa",
  "Filter": "Lọc",
  "Sort": "Sắp xếp",
  "Insert row(s) above": "Chèn dòng lên trên",
  "Insert row(s) below": "Chèn dòng xuống dưới",
  "Insert column(s) left": "Chèn cột sang trái",
  "Insert column(s) right": "Chèn cột sang phải",
  "Delete row(s)": "Xóa dòng",
  "Delete column(s)": "Xóa cột",
  "Row height": "Chiều cao dòng",
  "Column width": "Chiều rộng cột",
  "Sheet": "Trang tính",
  "More formats": "Thêm định dạng",
  "Currency": "Tiền tệ",
  "Percentage": "Phần trăm",
  "Number": "Số",
  "Date": "Ngày tháng",
  "Time": "Thời gian",
  "Text": "Văn bản",
  "Data Validation": "Xác thực dữ liệu",
  "Conditional Formatting": "Định dạng có điều kiện",
  "Find and replace": "Tìm kiếm và thay thế",
  "Comments": "Bình luận",
  "Insert image": "Chèn ảnh",
  "Insert link": "Chèn liên kết",
  "Chart": "Biểu đồ",
  "Formula": "Công thức",
  "Print": "In",
  "Left": "Trái",
  "Center": "Giữa",
  "Right": "Phải",
  "Top": "Trên",
  "Middle": "Giữa",
  "Bottom": "Dưới",
  "Rename": "Đổi tên",
  "Duplicate": "Nhân bản",
  "Delete": "Xóa",
  "Hide": "Ẩn",
  "Unhide": "Bỏ ẩn",
  "Move left": "Di chuyển sang trái",
  "Move right": "Di chuyển sang phải",
  "Ascending": "Tăng dần",
  "Descending": "Giảm dần",
};

filesToPatch.forEach(file => {
  const filePath = path.join(coreDistDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`Patching ${file}...`);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    for (const [en, vi] of Object.entries(translations)) {
      // Escape special regex characters if needed, but simple strings are fine
      // We replace the string exactly as it appears in the JSON-like object
      const regex = new RegExp(`"${en}"`, 'g');
      content = content.replace(regex, `"${vi}"`);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Successfully patched ${file}`);
  } else {
    console.warn(`File not found: ${filePath}`);
  }
});

console.log("Fortune Sheet localization patched to Vietnamese.");
