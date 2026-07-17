/**
 * User Resource Mapping Configuration
 * 
 * Cấu hình ánh xạ tài nguyên giữa các tài khoản.
 * Các tài khoản "restricted" sẽ:
 * - Chỉ xem được trang "Trợ lý báo cáo"
 * - Sử dụng tài nguyên (providers, API keys, model combos) từ tài khoản "resource owner"
 */

// Danh sách các tài khoản bị giới hạn chỉ xem trang "Trợ lý báo cáo"
const RESTRICTED_USERS = ["trang", "thu", "thủy", "nga"];

// Tài khoản chủ sở hữu tài nguyên mà restricted users sẽ dùng
const RESOURCE_OWNER = "minh";

/**
 * Mapping từng tài khoản → chỉ số (0-based) trong danh sách API keys của Minh.
 * Mỗi tài khoản chỉ dùng đúng 1 key riêng biệt.
 * - minh  → key thứ 1 (index 0)
 * - trang → key thứ 2 (index 1)
 * - thu   → key thứ 3 (index 2)
 * - thủy  → key thứ 4 (index 3)
 * - nga   → key thứ 5 (index 4)
 * Nếu không có đủ key, sẽ fallback về key active đầu tiên.
 */
const USER_KEY_INDEX = {
    minh: 0,
    trang: 1,
    thu: 2,
    thuy: 3,   // "thủy" sau khi normalize accent
    nga: 4,
};

/**
 * Check xem username có phải là restricted user không
 * @param {string} username 
 * @returns {boolean}
 */
export function isRestrictedUser(username) {
    if (!username) return false;
    const normalized = String(username).trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove Vietnamese accents
    return RESTRICTED_USERS.includes(normalized);
}

/**
 * Lấy username của resource owner cho restricted user
 * Nếu không phải restricted user thì return username gốc
 * @param {string} username 
 * @returns {string}
 */
export function getResourceUsername(username) {
    if (isRestrictedUser(username)) {
        return RESOURCE_OWNER;
    }
    return username;
}

/**
 * Trả về chỉ số API key (0-based) trong danh sách keys của Minh tương ứng với username.
 * Dùng để đảm bảo mỗi tài khoản dùng đúng 1 key riêng.
 * @param {string} username - username gốc của người dùng (trước khi map)
 * @returns {number} index trong mảng apiKeys (0-based); -1 nếu không tìm thấy mapping
 */
export function getApiKeyIndexForUser(username) {
    if (!username) return 0; // mặc định key đầu tiên
    const normalized = String(username).trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const idx = USER_KEY_INDEX[normalized];
    return typeof idx === "number" ? idx : -1;
}

/**
 * Normalize Vietnamese username (remove accents, lowercase, trim)
 * @param {string} username 
 * @returns {string}
 */
export function normalizeUsername(username) {
    if (!username) return "";
    return String(username).trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
