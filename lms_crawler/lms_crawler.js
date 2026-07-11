const readline = require("readline");
const cheerio = require("cheerio");
const axios = require("axios");
const { supabaseAdmin, processHtmlImagesAndUpload, cleanQuestionText, uploadFileToStorage } = require("./utils/db");
const { getHtmlWithSso, postHtmlWithSso, getCookieHeader } = require("./utils/sso");
const { processQuizReview } = require("./utils/quiz-processor");
const { extractMultipleChoice } = require("./utils/quiz-extractor");
require("dotenv").config();
const { clearCache } = require("./clear_redis_cache");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  console.log("=================================================");
  console.log("🚀 CÔNG CỤ CRAWL HỌC LIỆU MOODLE LMS - EHOU (CLI)");
  console.log("=================================================");

  try {
    let username = (process.env.LMS_USERNAME || "").trim();
    let password = (process.env.LMS_PASSWORD || "").trim();

    if (!username) {
      username = (await askQuestion("👤 Nhập tài khoản EHOU: ")).trim();
    } else {
      console.log(`👤 Tài khoản EHOU (tự động lấy từ env): [${username}]`);
    }

    if (!password) {
      password = (await askQuestion("🔑 Nhập mật khẩu EHOU: ")).trim();
    } else {
      console.log(`🔑 Mật khẩu EHOU: ****** (tự động lấy từ env)`);
    }

    if (!username || !password) {
      console.log("❌ Tài khoản hoặc mật khẩu không được để trống!");
      rl.close();
      return;
    }

    let searchKeywords = [];
    const envTitle = (process.env.LMS_DOCUMENT_TITLE || "").trim();

    if (envTitle && envTitle.toLowerCase() !== "false") {
      searchKeywords = envTitle.split(",").map(t => ({ id: null, title: t.trim() })).filter(x => x.title);
      console.log(`ℹ️ Sử dụng danh sách từ khóa tìm kiếm môn học từ env:`, searchKeywords.map(x => x.title));
    } else {
      console.log("ℹ️ Đang tự động kết nối và lấy danh sách tài liệu từ database...");
      try {
        const limitEnv = process.env.LMS_DB_DOCUMENTS_LIMIT;
        let limit = null;
        if (limitEnv && limitEnv.trim().toLowerCase() !== "false") {
          const parsedLimit = parseInt(limitEnv, 10);
          if (!isNaN(parsedLimit) && parsedLimit > 0) {
            limit = parsedLimit;
          }
        }

        let query = supabaseAdmin
          .from("documents")
          .select("id, title");
        if (limit !== null) {
          query = query.limit(limit);
          console.log(`ℹ️ Giới hạn số lượng lấy từ DB: ${limit} môn học.`);
        }

        const { data: dbDocs, error: docFetchErr } = await query;
        if (docFetchErr) {
          console.error(`⚠️ Lỗi lấy danh sách tài liệu từ DB: ${docFetchErr.message}`);
        } else if (dbDocs && dbDocs.length > 0) {
          searchKeywords = dbDocs.map(d => ({ id: d.id, title: d.title.trim() })).filter(x => x.title);
          console.log(`ℹ️ Lấy thành công từ database:`, searchKeywords.map(x => x.title));
        }
      } catch (err) {
        console.error("⚠️ Lỗi truy vấn database:", err.message);
      }
    }

    if (searchKeywords.length === 0) {
      const singleKeyword = (await askQuestion("👉 Nhập từ khóa để tìm kiếm môn học trên LMS (ví dụ: Triết học): ")).trim();
      if (singleKeyword) {
        searchKeywords = [{ id: null, title: singleKeyword }];
      }
    }

    if (searchKeywords.length === 0) {
      console.log("❌ Không tìm thấy từ khóa hoặc môn học nào để tìm kiếm!");
      rl.close();
      return;
    }

    let isTestMode = true;
    const envTestMode = process.env.LMS_TEST_MODE;
    if (envTestMode !== undefined && envTestMode !== "") {
      isTestMode = envTestMode.trim().toLowerCase() === "true";
      console.log(`ℹ️ Tự động nhận diện chế độ chạy từ env: ${isTestMode ? "TEST (Giới hạn 2 tuần)" : "FULL"}`);
    } else {
      const testModeStr = await askQuestion("🧪 Bạn có muốn chạy ở chế độ TEST (chỉ crawl 2 tuần đầu tiên)? (Y/n): ");
      isTestMode = testModeStr.toLowerCase() !== "n";
      console.log(`ℹ️ Đang chạy ở chế độ: ${isTestMode ? "TEST (Giới hạn 2 tuần)" : "FULL"}`);
    }

    console.log("\n🔑 Đang kết nối tới Moodle LMS learning.ehou.edu.vn...");
    const loginUrl = "https://learning.ehou.edu.vn/login/index.php";

    const res1 = await getHtmlWithSso(loginUrl);

    const $1 = cheerio.load(res1.data);
    let loginRes = null;
    const isAlreadyLoggedIn = $1('a[href*="login/logout.php"]').length > 0;

    if (isAlreadyLoggedIn) {
      console.log("✅ Đã khôi phục phiên đăng nhập cũ thành công (sử dụng session cookie từ cookies.txt)!");
      loginRes = res1;
    } else {
      const lt = $1('input[name="lt"]').val();
      const execution = $1('input[name="execution"]').val();

      if (lt && execution) {
        console.log("🔑 Phát hiện cổng CAS SSO. Tiến hành đăng nhập qua CAS...");
        const casLoginUrl = res1.config.url || "https://cas.ehou.edu.vn/cas/login?service=https%3A%2F%2Flearning.ehou.edu.vn%2Flogin%2Findex.php&gateway=true";
        const loginParams = new URLSearchParams({
          username: username,
          password: password,
          lt: lt,
          execution: execution,
          _eventId: "submit",
          submit: "ĐĂNG NHẬP"
        }).toString();

        loginRes = await postHtmlWithSso(casLoginUrl, loginParams);
      } else {
        const logintoken = $1('input[name="logintoken"]').val();
        if (!logintoken) {
          throw new Error("Không tìm thấy các trường đăng nhập bảo mật (lt, execution hoặc logintoken).");
        }

        console.log("🔑 Tiến hành đăng nhập trực tiếp (Moodle truyền thống)...");
        const loginParams = new URLSearchParams({
          username: username,
          password: password,
          logintoken: logintoken
        }).toString();

        loginRes = await postHtmlWithSso(loginUrl, loginParams);
      }

      if (loginRes && loginRes.config && loginRes.config.url) {
        const finalUrl = loginRes.config.url;
        if (finalUrl.includes("cas.ehou.edu.vn/cas/login")) {
          const $err = cheerio.load(loginRes.data);
          const errMsg = $err("#msg, .errors, .alert-danger, .status, #status, .error").text().trim();
          throw new Error(`Đăng nhập cổng CAS thất bại. Chi tiết lỗi từ trường: "${errMsg || "Sai tài khoản/mật khẩu hoặc bị chặn bot"}"`);
        }
      }
    }

    const dashRes = await getHtmlWithSso("https://learning.ehou.edu.vn/my/");
    const $dash = cheerio.load(dashRes.data);
    const logoutBtn = $dash('a[href*="login/logout.php"]');

    if (logoutBtn.length === 0) {
      throw new Error("Đăng nhập thất bại! Vui lòng kiểm tra lại tài khoản & mật khẩu.");
    }

    console.log("✅ Đăng nhập LMS thành công!");

    const isTestDocument = process.env.LMS_TEST_DOCUMENT === "true";
    const maxCoursesEnv = parseInt(process.env.LMS_MAX_COURSES, 10);
    const maxCourses = !isNaN(maxCoursesEnv) && maxCoursesEnv > 0 ? maxCoursesEnv : 10;

    const coursesToCrawl = [];
    const maxSearchPages = 10; // Giới hạn quét tối đa 10 trang tìm kiếm

    console.log(`\n🔍 Bắt đầu pha tìm kiếm và đối chiếu môn học cho ${searchKeywords.length} tài liệu...`);

    for (let kIdx = 0; kIdx < searchKeywords.length; kIdx++) {
      const keywordObj = searchKeywords[kIdx];
      const keyword = keywordObj.title;
      const docId = keywordObj.id;

      console.log(`\n----------------------------------------------------------------------`);
      console.log(`🔍 [${kIdx + 1}/${searchKeywords.length}] Tìm kiếm môn học cho tài liệu: "${keyword}"`);
      console.log(`----------------------------------------------------------------------`);

      const matchedCourses = [];
      const rejectedCourses = [];
      let page = 0;
      let hasMorePages = true;

      while (hasMorePages && page < maxSearchPages) {
        const searchUrl = `https://learning.ehou.edu.vn/course/search.php?search=${encodeURIComponent(keyword)}&page=${page}`;
        console.log(`   🔎 Đang quét trang kết quả tìm kiếm [${page + 1}]...`);
        
        const searchRes = await getHtmlWithSso(searchUrl);
        const $search = cheerio.load(searchRes.data);

        const foundInPage = [];
        $search(".coursebox .coursename a").each((i, el) => {
          const href = $search(el).attr("href");
          const title = $search(el).text().trim();
          if (href && title) {
            if (!foundInPage.some(c => c.href === href)) {
              foundInPage.push({ href, title });
            }
          }
        });

        if (foundInPage.length === 0) {
          hasMorePages = false;
          break;
        }

        let newCoursesCount = 0;
        for (let i = 0; i < foundInPage.length; i++) {
          const c = foundInPage[i];
          const similarity = getCourseSimilarity(keyword, c.title);
          
          const cleanKeyword = stripVietnameseDiacritics(keyword).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
          const cleanTitle = stripVietnameseDiacritics(c.title).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
          const isPart = cleanTitle.includes(cleanKeyword);

          const isMatched = similarity > 0.9 && isPart;
          c.similarity = similarity;
          
          if (isMatched) {
            const alreadyListed = matchedCourses.some(x => x.href === c.href);
            if (!alreadyListed) {
              newCoursesCount++;
              matchedCourses.push(c);
            } else {
              const existing = matchedCourses.find(x => x.href === c.href);
              if (c.similarity > existing.similarity) {
                existing.similarity = c.similarity;
              }
            }
          } else {
            const alreadyListed = rejectedCourses.some(x => x.href === c.href || matchedCourses.some(m => m.href === c.href));
            if (!alreadyListed) {
              newCoursesCount++;
              rejectedCourses.push(c);
            }
          }
        }

        if (newCoursesCount === 0) {
          hasMorePages = false;
          break;
        }

        const nextBtn = $search("ul.pagination a.next, .coursemos-paging a.next, nav.pagination a[aria-label='Next'], nav.pagination a[aria-label='Tiếp theo'], .paging a.next");
        const hasPagination = $search("ul.pagination, .coursemos-paging, nav.pagination, .paging").length > 0;
        
        if (nextBtn.length === 0 && hasPagination) {
          hasMorePages = false;
          break;
        }

        page++;
      }

      if (matchedCourses.length === 0 && rejectedCourses.length === 0) {
        console.log(`⚠️ Không tìm thấy môn học nào trên LMS khớp với từ khóa: "${keyword}"`);
        continue;
      }

      matchedCourses.sort((a, b) => b.similarity - a.similarity);
      rejectedCourses.sort((a, b) => b.similarity - a.similarity);

      const finalMatchedCourses = matchedCourses.slice(0, maxCourses);

      console.log(`\n   🎯 CÁC MÔN SẼ LẤY DATA (Chấp nhận - Tương đồng > 90% và chứa tên):`);
      if (finalMatchedCourses.length > 0) {
        finalMatchedCourses.forEach((c, idx) => {
          console.log(`      [${idx + 1}] ${c.title} (Độ tương đồng: ${Math.round(c.similarity * 100)}%)`);
        });
      } else {
        console.log(`      (Không có môn học nào thỏa mãn)`);
      }

      console.log(`\n   ⏭️ CÁC MÔN SẼ BỎ QUA (Bị loại - Tương đồng <= 90%):`);
      if (rejectedCourses.length > 0) {
        rejectedCourses.forEach((c, idx) => {
          console.log(`      [${idx + 1}] ${c.title} (Độ tương đồng: ${Math.round(c.similarity * 100)}%)`);
        });
      } else {
        console.log(`      (Không có môn học nào bị loại)`);
      }

      if (finalMatchedCourses.length === 0) {
        console.log(`⚠️ Không có môn học nào đủ độ tương đồng với tài liệu: "${keyword}".`);
        continue;
      }

      // Xác định document tương ứng cho các môn học khớp
      let selectedDoc = null;
      if (docId) {
        // Lấy thông tin mới nhất từ database
        const { data: dbDoc } = await supabaseAdmin
          .from("documents")
          .select("id, title")
          .eq("id", docId)
          .single();
        selectedDoc = dbDoc || { id: docId, title: keyword };
      }

      let targetCourses = [];
      if (isTestMode) {
        console.log(`🧪 Chế độ TEST: chỉ crawl môn học khớp nhất đầu tiên cho tài liệu này.`);
        targetCourses = [finalMatchedCourses[0]];
      } else {
        targetCourses = finalMatchedCourses;
      }

      for (let cIdx = 0; cIdx < targetCourses.length; cIdx++) {
        const currentCourse = targetCourses[cIdx];
        const courseLink = currentCourse.href;
        const courseTitle = currentCourse.title;

        // Xác định document tương ứng cho môn học khớp
        let selectedDoc = null;
        if (docId) {
          // Lấy thông tin mới nhất từ database
          const { data: dbDoc } = await supabaseAdmin
            .from("documents")
            .select("id, title")
            .eq("id", docId)
            .single();
          selectedDoc = dbDoc || { id: docId, title: keyword };
        }

        // Fallback so khớp nếu chưa có selectedDoc (ví dụ: lấy từ env)
        if (!selectedDoc) {
          const { data: dbDocs } = await supabaseAdmin.from("documents").select("id, title");
          const normLmsTitle = normalizeDetectedCourseTitle(courseTitle);
          const titleParts = normLmsTitle.split("/").map(t => t.trim()).filter(Boolean);
          const cleanWebTitles = titleParts.map(part => normalizeTextForMatching(part));

          if (dbDocs && dbDocs.length > 0) {
            for (const doc of dbDocs) {
              const cleanDocTitle = normalizeTextForMatching(doc.title);
              const isMatched = cleanWebTitles.some(cleanWebTitle => isCourseTitleMatch(cleanWebTitle, cleanDocTitle));
              if (isMatched) {
                selectedDoc = doc;
                break;
              }
            }
          }

          if (selectedDoc) {
            console.log(`💾 Sử dụng tài liệu đối chiếu hiện có trong DB: "${selectedDoc.title}" (Khớp với môn học trên LMS: "${courseTitle}")`);
          } else {
            console.log(`🆕 Không tìm thấy tài liệu nào khớp với "${courseTitle}" trong DB. Tiến hành tạo mới...`);
            const { data: newDoc, error: insErr } = await supabaseAdmin
              .from("documents")
              .insert({ title: courseTitle })
              .select()
              .single();
            if (insErr) {
              throw new Error(`Không thể tạo tài liệu mới: ${insErr.message}`);
            }
            selectedDoc = newDoc;
            console.log(`✅ Đã tạo mới tài liệu đối chiếu: "${selectedDoc.title}"`);
          }
        } else {
          console.log(`💾 Sử dụng tài liệu đối chiếu từ database: "${selectedDoc.title}"`);
        }

        const moodleCourseIdMatch = courseLink.match(/id=(\d+)/);
        const moodleCourseId = moodleCourseIdMatch ? moodleCourseIdMatch[1] : "";
        
        console.log(`\n======================================================================`);
        console.log(`🔄 [Môn ${cIdx + 1}/${targetCourses.length}] BẮT ĐẦU CRAWL MÔN HỌC: "${courseTitle}" (LMS ID: ${moodleCourseId})`);
        console.log(`======================================================================`);

    let dbCourse = null;
    const { data: existingCourses, error: findErr } = await supabaseAdmin
      .from("crawler_courses")
      .select("*")
      .eq("moodle_course_id", moodleCourseId)
      .limit(1);

    if (!findErr && existingCourses && existingCourses.length > 0) {
      dbCourse = existingCourses[0];
      console.log("💾 Môn học đã tồn tại trong DB, sử dụng thông tin môn học hiện có.");
    } else {
      const { data, error: courseErr } = await supabaseAdmin.from("crawler_courses").insert({
        document_id: selectedDoc.id,
        moodle_course_id: moodleCourseId,
        title: courseTitle,
        url: courseLink
      }).select().single();

      if (courseErr || !data) {
        throw new Error(`Không lưu được môn học vào DB: ${courseErr ? courseErr.message : ""}`);
      }
      dbCourse = data;
      console.log("💾 Đã lưu thông tin môn học mới vào DB.");
    }

    // Hàm chuẩn hóa title bằng cách loại bỏ các hậu tố loại hình Moodle Việt hóa/Anh hóa thừa ở cuối
    const cleanTitle = (t) => {
      if (!t) return "";
      return t.replace(/\s*(Trang|Tệp|File|URL|Quiz|Page|Forum|Bài trắc nghiệm|Diễn đàn|Liên kết)$/gi, "").trim();
    };

    // Trả về record đầy đủ hoặc null nếu không tồn tại (lọc theo type)
    const findResource = async (title, type, weekName) => {
      const cleaned = cleanTitle(title);
      // Các hậu tố Moodle cũ có thể được lưu kèm
      const suffix = type === "announcement" ? "Trang" : type === "file" ? "Tệp" : type === "link" ? "Liên kết" : "";
      const titleWithSuffix = suffix ? `${cleaned} ${suffix}` : cleaned;

      // Tìm bằng title gốc, title sạch, hoặc title có kèm hậu tố Moodle Việt hóa
      const { data } = await supabaseAdmin
        .from("crawler_resources")
        .select("id, content_url, type, title")
        .eq("course_id", dbCourse.id)
        .eq("type", type)
        .eq("week_name", weekName)
        .or(`title.eq."${title}",title.eq."${cleaned}",title.eq."${titleWithSuffix}"`);
      return data && data.length > 0 ? data[0] : null;
    };

    // Tìm record theo title + weekName, không lọc theo type
    const findResourceAnyType = async (title, weekName) => {
      const cleaned = cleanTitle(title);
      // Tìm thử với mọi hậu tố có thể có
      const suffixes = ["Trang", "Tệp", "Liên kết", "File", "URL", "Quiz", "Page"];
      const orConditions = [
        `title.eq."${title}"`,
        `title.eq."${cleaned}"`
      ];
      suffixes.forEach(s => {
        orConditions.push(`title.eq."${cleaned} ${s}"`);
      });

      const { data } = await supabaseAdmin
        .from("crawler_resources")
        .select("id, content_url, type, title")
        .eq("course_id", dbCourse.id)
        .eq("week_name", weekName)
        .or(orConditions.join(","));
      return data && data.length > 0 ? data[0] : null;
    };

    const isResourceExists = async (title, type, weekName) => {
      return (await findResource(title, type, weekName)) !== null;
    };

    // Trả về true nếu URL hiện tại cần được cập nhật bằng newUrl tốt hơn
    const needsUrlUpdate = (existingUrl, newUrl) => {
      if (!existingUrl || existingUrl.trim() === "") return true;
      if (!newUrl || newUrl === existingUrl) return false;
      
      // Nếu link cũ là "None" và link mới là một link thực tế (không phải None) → Cập nhật link mới
      if (existingUrl === "None" && newUrl !== "None") return true;

      // mod/url/view.php là wrapper trung gian → luôn cập nhật sang destination thực sự (dù là BBB hay playback)
      if (/\/mod\/url\/view\.php/i.test(existingUrl)) return true;

      // mod/bigbluebuttonbn/view.php → luôn cập nhật khi có link playback thực sự, hoặc cập nhật sang None nếu chưa có
      if (/\/mod\/bigbluebuttonbn\/view\.php/i.test(existingUrl)) return true;
      
      return false;
    };

    const updateResourceUrl = async (id, newUrl) => {
      await supabaseAdmin.from("crawler_resources").update({ content_url: newUrl }).eq("id", id);
    };

    const updateResourceUrlAndType = async (id, newUrl, newType) => {
      await supabaseAdmin.from("crawler_resources").update({ content_url: newUrl, type: newType }).eq("id", id);
    };

    const isQuestionExists = async (questionText) => {
      const { data } = await supabaseAdmin
        .from("crawler_questions")
        .select("id")
        .eq("course_id", dbCourse.id)
        .eq("question", questionText)
        .limit(1);
      return data && data.length > 0;
    };

    console.log(`\n🌐 Đang tải cấu trúc môn học từ: ${courseLink}...`);
    const courseRes = await getHtmlWithSso(courseLink);
    const $course = cheerio.load(courseRes.data);

    const sectionLinks = [];
    $course("a[href*='section=']").each((i, el) => {
      const href = $course(el).attr("href");
      const match = href.match(/section=(\d+)/);
      if (match) {
        sectionLinks.push(parseInt(match[1], 10));
      }
    });
    const uniqueSections = [...new Set(sectionLinks)].sort((a, b) => a - b);

    let sectionsToCrawl = [];
    if (uniqueSections.length > 0) {
      sectionsToCrawl = uniqueSections;
    } else {
      const currentSectionMatch = courseRes.config.url.match(/section=(\d+)/);
      if (currentSectionMatch) {
        sectionsToCrawl.push(parseInt(currentSectionMatch[1], 10));
      } else {
        sectionsToCrawl.push(0);
      }
    }
    console.log(`📅 Tìm thấy ${sectionsToCrawl.length} phần học/tuần học cần tải.`);

    let fileCount = 0;
    let youtubeCount = 0;
    let quizCount = 0;
    let sectionCrawledCount = 0;

    for (let idx = 0; idx < sectionsToCrawl.length; idx++) {
      const sectionNum = sectionsToCrawl[idx];
      const sectionUrl = `https://learning.ehou.edu.vn/course/view.php?id=${moodleCourseId}&section=${sectionNum}`;
      console.log(`\n🌐 Đang tải tuần học từ: ${sectionUrl}...`);
      const secRes = await getHtmlWithSso(sectionUrl);
      const $secPage = cheerio.load(secRes.data);

      const sections = $secPage("li.section.main");
      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        const sectionName = $secPage(sec).find(".sectionname, .section-title, h3").first().text().trim() || `Phần ${sectionNum}`;

        // Test mode: chỉ crawl 2 tuần đầu tiên có nội dung
        if (isTestMode && sectionCrawledCount >= 2) {
          continue;
        }

        console.log(`\n-------------------------------------------------`);
        console.log(`📖 Đang crawl tuần/phần: "${sectionName}"`);
        console.log(`-------------------------------------------------`);

         const activities = $secPage(sec).find("li.activity");
         const activityQueue = [];

         for (let a = 0; a < activities.length; a++) {
           const act = activities[a];
           const isLabel = $secPage(act).hasClass("label");

           if (isLabel) {
             // Với nhãn Label, quét tất cả các thẻ A liên kết học liệu Moodle con bên trong
             $secPage(act).find("a").each((i, el) => {
               const href = $secPage(el).attr("href");
               if (href && (href.includes("mod/resource/view.php") || href.includes("mod/url/view.php") || href.includes("mod/quiz/view.php") || href.includes("mod/page/view.php") || href.includes("mod/scorm/view.php"))) {
                 
                 // Thử lấy tên hiển thị:
                 let name = $secPage(el).text().trim();
                 if (!name) {
                   const $img = $secPage(el).find("img").first();
                   name = $img.attr("title") || $img.attr("alt") || "";
                 }
                 
                 // Nếu click bằng icon download chung chung, quét text trong hàng hoặc cột của table đó để làm title
                 if (!name || name.toLowerCase().includes("icon") || name.toLowerCase() === "") {
                   const tdText = $secPage(el).closest("td").prev("td").text().trim();
                   if (tdText) name = tdText;
                 }

                 activityQueue.push({ href, name, act, originalLink: $secPage(el) });
               }
             });
           } else {
             const $link = $secPage(act).find("a").first();
             const href = $link.attr("href");
             if (href) {
               activityQueue.push({ href, name: "", act, originalLink: $link });
             }
           }
         }

         for (const { href, name: subName, act, originalLink } of activityQueue) {
           // Tiêu đề của hoạt động
           let rawName = subName;
           if (!rawName) {
             rawName = $secPage(act).find(".instancename").text().trim();
           }
           if (!rawName) {
             // Fallback 1: lấy trực tiếp text của link
             rawName = originalLink.text().trim();
           }
           if (!rawName) {
             // Fallback 2: nếu link chỉ chứa hình ảnh, lấy alt hoặc title của ảnh đó
             const $img = originalLink.find("img").first();
             rawName = $img.attr("title") || $img.attr("alt") || "";
           }
           if (!rawName) {
             // Fallback 3: dùng ID từ URL để định danh
             const idMatch = href.match(/id=(\d+)/);
             rawName = idMatch ? `Bài giảng điện tử (ID ${idMatch[1]})` : "";
           }
           
           // Clean hậu tố loại hình
           rawName = rawName.replace(/File|URL|Quiz|Page|Forum|SCORM package/gi, "").trim();
           
           let activityName = rawName;

          if (href.includes("mod/resource/view.php")) {
             try {
               // 1. Bắt buộc lấy tên file thực tế từ header Content-Disposition của Moodle
               let resolvedName = "";
               try {
                 const headRes = await axios.head(href, {
                   headers: { Cookie: getCookieHeader() },
                   maxRedirects: 5,
                   timeout: 10000
                 });
                 const disposition = headRes.headers["content-disposition"] || "";
                   if (disposition) {
                    const utf8Match = disposition.match(/filename\*=\s*UTF-8''([^";\n]+)/i);
                    if (utf8Match) {
                      try {
                        resolvedName = decodeURIComponent(utf8Match[1].trim());
                      } catch (e) {
                        // ignore
                      }
                    } else {
                      const match = disposition.match(/filename="?([^";\n]+)"?/i);
                      if (match) {
                        try {
                          const rawName = match[1].trim();
                          resolvedName = Buffer.from(rawName, 'binary').toString('utf8');
                        } catch (e) {
                          resolvedName = match[1].trim();
                        }
                      }
                    }
                  }
                 if (!resolvedName) {
                   const finalHref = (headRes.request && headRes.request.res ? headRes.request.res.responseUrl : null) || headRes.url || href;
                   resolvedName = decodeURIComponent(finalHref.split("/").pop().split("?")[0]);
                 }
               } catch (headErr) {
                 console.log(`   ⚠️ Lỗi lấy header của file (sử dụng tên hiển thị thay thế): ${headErr.message}`);
               }

               // Ưu tiên dùng tên file thực tế đầy đủ làm activityName
               if (resolvedName) {
                 activityName = resolvedName;
               }

               // Bước 2: Kiểm tra record đã tồn tại chưa bằng tên file thực tế mới
               const existingRecord = await findResourceAnyType(activityName, sectionName);
               
               // Đồng thời kiểm tra xem có record cũ nào dùng tên hiển thị cũ (ví dụ: "Wordlist" hay "Transcripts") không để cập nhật
               const displayTitle = subName || rawName;
               const existingOldDisplay = (displayTitle && displayTitle !== activityName) 
                 ? await findResourceAnyType(displayTitle, sectionName) 
                 : null;

               if (existingRecord) {
                 console.log(`   ⏭️ File "${activityName}" đã tồn tại trong DB. Bỏ qua.`);
                 fileCount++;
                 continue;
               }

               if (existingOldDisplay) {
                 // Cập nhật đổi tên record cũ thành tên file thực tế đầy đủ mới
                 await supabaseAdmin.from("crawler_resources")
                   .update({ title: activityName })
                   .eq("id", existingOldDisplay.id);
                 console.log(`   🔄 Đã chuẩn hóa và cập nhật tên file thực tế mới cho record cũ: "${displayTitle}" ➔ "${activityName}"`);
                 fileCount++;
                 continue;
               }

               // Bước 3: Upload và lưu mới
               console.log(`   📎 Đang tải file tài liệu: "${activityName}"...`);
               const filePublicUrl = await uploadFileToStorage(href, "files", getCookieHeader);
               
               // Nếu vẫn chưa có tên sau upload, lấy từ storage URL
               let finalTitle = activityName;
               if (!finalTitle) {
                 const urlPart = filePublicUrl.split("/").pop().split("?")[0];
                 finalTitle = decodeURIComponent(urlPart).replace(/^\d+_/, "");
               }
               // Đảm bảo không đặt tên chung chung dạng "Bài giảng điện tử (ID...)" nếu lấy được tên file thực tế từ URL
               if (finalTitle.startsWith("Bài giảng điện tử (ID") && filePublicUrl.includes(".")) {
                 const urlPart = filePublicUrl.split("/").pop().split("?")[0];
                 finalTitle = decodeURIComponent(urlPart).replace(/^\d+_/, "");
               }

               await supabaseAdmin.from("crawler_resources").insert({
                 course_id: dbCourse.id,
                 type: "file",
                 title: finalTitle,
                 content_url: filePublicUrl,
                 week_name: sectionName
               });
               fileCount++;
               console.log(`   ✅ Đã tải & lưu file thành công: "${finalTitle}"`);
             } catch (err) {
               console.log(`   ⚠️ Lỗi tải file: ${err.message}`);
             }
           }

           else if (href.includes("mod/url/view.php") || href.includes("mod/bigbluebuttonbn/view.php")) {
            try {
              console.log(`   🔗 Đang trích xuất link: "${activityName}"...`);
              const urlRes = await getHtmlWithSso(href);
              const $urlPage = cheerio.load(urlRes.data);
              // Lấy URL đích thực sau khi redirect
              let finalUrl = $urlPage(".urlworkaround a").attr("href")
                || $urlPage("iframe").attr("src")
                || href;

              // Kiểm tra nếu trang đích là BigBlueButton (lớp học trực tuyến đã ghi)
              const isBBB = finalUrl.includes("mod/bigbluebuttonbn/view.php")
                || (urlRes.data ? urlRes.data.includes : undefined)("mod/bigbluebuttonbn")
                || ($urlPage("body").attr("class") ? $urlPage("body").attr("class").includes : undefined)("bigbluebuttonbn");

              if (isBBB) {
                // Tải trang BBB để lấy link playback thực sự
                const bbbUrl = finalUrl.includes("mod/bigbluebuttonbn")
                  ? finalUrl
                  : $urlPage("a[href*='mod/bigbluebuttonbn']").attr("href") || finalUrl;
                console.log(`   🎥 Phát hiện lớp học BBB, đang vào trang ghi hình: ${bbbUrl}`);
                const bbbRes = await getHtmlWithSso(bbbUrl);
                const $bbb = cheerio.load(bbbRes.data);
                // Tìm link bản ghi: "trình chiếu", "presentation", hoặc link playback BBB
                const playbackLink = $bbb("a[href*='playback'], a[href*='bbb'], a[title*='trình chiếu'], a[title*='presentation']").first().attr("href")
                  || $bbb("a[href*='bbb']").first().attr("href");
                if (playbackLink) {
                  finalUrl = playbackLink;
                  console.log(`   ✅ Đã lấy được link bản ghi lớp học: ${finalUrl}`);
                } else {
                  // Moodle BBB chưa có bản ghi (ví dụ: "This conference has not started yet")
                  // Lưu "None" thay vì link BBB nội bộ của Moodle theo yêu cầu
                  console.log(`   ℹ️ Chưa có bản ghi lớp học (Trang hiển thị lớp học chưa bắt đầu). Gán link là "None".`);
                  finalUrl = "None";
                }
              }

              const isYoutube = /youtube\.com|youtu\.be/i.test(finalUrl);
              if (isYoutube) {
                console.log(`   ⏭️ Bỏ qua tài nguyên video YouTube trực tiếp: ${finalUrl}`);
                continue;
              }
              const isFile = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|mp3|mp4|zip|rar)(\?|$)/i.test(finalUrl)
                || finalUrl.includes("pluginfile.php");
              const resourceType = isFile ? "file" : "link";

              // Tìm không phân biệt type để bắt cả các record cũ có type sai
              const existingRecord = await findResourceAnyType(activityName, sectionName);
              if (existingRecord) {
                const needsUpdate = needsUrlUpdate(existingRecord.content_url, finalUrl);
                const typeChanged = existingRecord.type !== resourceType;
                if (needsUpdate || typeChanged) {
                  await updateResourceUrlAndType(existingRecord.id, finalUrl, resourceType);
                  console.log(`   🔄 Đã cập nhật link${typeChanged ? ` (type: ${existingRecord.type}→${resourceType})` : ""} cho "${activityName}": ${finalUrl}`);
                } else {
                  console.log(`   ⏭️ "${activityName}" đã tồn tại và link đúng. Bỏ qua.`);
                }
              } else {
                if (isFile) {
                  try {
                    const filePublicUrl = await uploadFileToStorage(finalUrl, "files", getCookieHeader);
                    await supabaseAdmin.from("crawler_resources").insert({
                      course_id: dbCourse.id,
                      type: "file",
                      title: activityName,
                      content_url: filePublicUrl,
                      week_name: sectionName
                    });
                    fileCount++;
                    console.log(`   ✅ Đã tải & lưu file từ URL: ${finalUrl}`);
                  } catch (dlErr) {
                    await supabaseAdmin.from("crawler_resources").insert({
                      course_id: dbCourse.id,
                      type: "link",
                      title: activityName,
                      content_url: finalUrl,
                      week_name: sectionName
                    });
                    console.log(`   ✅ Lưu link URL (không tải được file): ${finalUrl}`);
                  }
                } else {
                  await supabaseAdmin.from("crawler_resources").insert({
                    course_id: dbCourse.id,
                    type: "link",
                    title: activityName,
                    content_url: finalUrl,
                    week_name: sectionName
                  });
                  console.log(`   ✅ Đã lưu link URL: ${finalUrl}`);
                }
              }
            } catch (err) {
              console.log(`   ⚠️ Lỗi trích xuất link: ${err.message}`);
            }
          }

          else if (href.includes("mod/page/view.php") || href.includes("mod/lesson/view.php")) {
            try {
              const existingRecord = await findResourceAnyType(activityName, sectionName);
              let shouldCrawl = true;

              if (existingRecord) {
                // Lấy thông tin raw_content để check xem có bẩn không
                const { data } = await supabaseAdmin
                  .from("crawler_resources")
                  .select("raw_content")
                  .eq("id", existingRecord.id)
                  .limit(1);
                
                const oldContent = data && data[0] ? data[0].raw_content : "";
                const hasTrashHtml = oldContent && (oldContent.includes("progress-bar") || oldContent.includes("footer_menu") || oldContent.includes("breadcrumb"));
                const typeChanged = existingRecord.type !== "announcement";

                if (!hasTrashHtml && !typeChanged) {
                  console.log(`   ⏭️ Trang "${activityName}" đã tồn tại và nội dung sạch. Bỏ qua.`);
                  shouldCrawl = false;
                } else {
                  console.log(`   🔄 Phát hiện trang cũ "${activityName}" (type: ${existingRecord.type}) cần dọn dẹp/chuyển đổi sang announcement. Tiến hành crawl...`);
                }
              }

              if (!shouldCrawl) {
                continue;
              }

              console.log(`   📄 Đang crawl nội dung trang: "${activityName}"...`);
              const pageRes = await getHtmlWithSso(href);
              const $page = cheerio.load(pageRes.data);

              // Lấy phần content thực sự bên trong Page/Lesson
              let pageContent = "";
              const contentSelector = ".no-overflow, .box.generalbox, .lessonpage, .generalbox";
              const contentEl = $page(contentSelector).first();
              
              if (contentEl.length) {
                pageContent = contentEl.html();
              } else {
                const mainRegion = $page("#region-main").clone();
                mainRegion.find(".section_progress, .navigation, .modified, #page-footer, .footer_menu, .copyright, script, style").remove();
                pageContent = mainRegion.html() || "";
              }

              const { cleanHtml: cleanPageContent } = await processHtmlImagesAndUpload(pageContent, getCookieHeader);

              const $cleanPage = cheerio.load(cleanPageContent || "", null, false);
              const hasYoutube = $cleanPage("iframe[src*='youtube.com'], iframe[src*='youtu.be']").length > 0
                || /youtube\.com|youtu\.be/i.test(cleanPageContent || "");
              
              if (hasYoutube) {
                console.log(`   ⏭️ Bỏ qua trang học liệu "${activityName}" vì chứa video YouTube.`);
                continue;
              }

              // Bỏ qua việc lấy video YouTube làm tài nguyên
              let finalType = "announcement";
              let finalContentUrl = null;
              let finalRawContent = cleanPageContent;

              if (existingRecord) {
                // Cập nhật lại record cũ: đổi type thành finalType và lưu nội dung sạch
                await supabaseAdmin
                  .from("crawler_resources")
                  .update({ 
                    raw_content: finalRawContent,
                    content_url: finalContentUrl,
                    type: finalType 
                  })
                  .eq("id", existingRecord.id);
                console.log(`   ✅ Đã cập nhật, dọn dẹp và chuyển đổi type thành ${finalType} cho trang cũ.`);
              } else {
                // Lưu record mới nếu thực sự chưa có
                await supabaseAdmin.from("crawler_resources").insert({
                  course_id: dbCourse.id,
                  type: finalType,
                  title: activityName,
                  content_url: finalContentUrl,
                  raw_content: finalRawContent,
                  week_name: sectionName
                });
                console.log(`   ✅ Đã lưu nội dung trang mới dưới dạng ${finalType}.`);
              }

              // Trích xuất và thử tải các file đính kèm trong nội dung trang
              const fileLinks = $page("a[href*='pluginfile.php'], a[href$='.pdf'], a[href$='.doc'], a[href$='.docx']");
              for (let fl = 0; fl < fileLinks.length; fl++) {
                const fileHref = $page(fileLinks[fl]).attr("href");
                const fileLinkTitle = $page(fileLinks[fl]).text().trim() || `Tệp ${fl + 1}`;
                if (!fileHref) continue;
                if (await isResourceExists(fileLinkTitle, "file", sectionName)) continue;
                try {
                  const filePublicUrl = await uploadFileToStorage(fileHref, "files", getCookieHeader);
                  await supabaseAdmin.from("crawler_resources").insert({
                    course_id: dbCourse.id,
                    type: "file",
                    title: fileLinkTitle,
                    content_url: filePublicUrl,
                    week_name: sectionName
                  });
                  fileCount++;
                  console.log(`   ✅ Đã tải file đính kèm trong trang: "${fileLinkTitle}"`);
                } catch (flErr) {
                  console.log(`   ⚠️ Không tải được file đính kèm "${fileLinkTitle}": ${flErr.message}`);
                }
              }
            } catch (err) {
              console.log(`   ⚠️ Lỗi trích xuất trang Page: ${err.message}`);
            }
          }

          else if (href.includes("mod/scorm/view.php")) {
            // Loại bỏ hoàn toàn theo yêu cầu của người dùng
            console.log(`   ⏭️ Phát hiện bài giảng điện tử SCORM: "${activityName}". Bỏ qua theo yêu cầu.`);
            continue;
          }

          else if (href.includes("mod/quiz/view.php")) {
            try {
              console.log(`   📝 Phát hiện bài trắc nghiệm: "${activityName}"...`);
              const quizRes = await getHtmlWithSso(href);
              const $quizPage = cheerio.load(quizRes.data);

              const quizIdMatch = href.match(/id=(\d+)/);
              const quizId = quizIdMatch ? quizIdMatch[1] : "";

              const attemptLinks = [];
              if (quizId) {
                const reportUrl = `https://learning.ehou.edu.vn/mod/quiz/report.php?id=${quizId}&mode=overview`;
                console.log(`   🔍 Quét danh sách bài làm của mọi sinh viên từ: ${reportUrl}`);
                try {
                  const reportRes = await getHtmlWithSso(reportUrl);
                  const $reportPage = cheerio.load(reportRes.data);

                   const hasTable = $reportPage("table.generaltable, table#attempts").length > 0;

                   if (!hasTable) {
                     console.log(`   ℹ️ Trang báo cáo không có bảng điểm bài làm cá nhân. Bỏ qua.`);
                   } else {
                     $reportPage("table.generaltable tbody tr, table#attempts tbody tr").each((i, tr) => {
                       const attemptLinkEl = $reportPage(tr).find("a[href*='review.php?attempt=']");
                       if (attemptLinkEl.length === 0) return;
                       const attemptHref = attemptLinkEl.attr("href");

                       let grade = null;
                       $reportPage(tr).find("td").each((j, td) => {
                         const text = $reportPage(td).text().trim().replace(",", ".");
                         const val = parseFloat(text);
                         if (!isNaN(val) && val >= 0 && val <= 100) {
                           // Ưu tiên cột điểm tổng (thường có class bold, c7, hoặc là cột điểm đầu tiên)
                           if (grade === null || $reportPage(td).hasClass("bold") || $reportPage(td).attr("class")?.includes("c7")) {
                             grade = val;
                           }
                         }
                       });

                       if (grade !== null) {
                         const normalizedGrade = grade <= 10 ? grade * 10 : grade;
                         if (normalizedGrade >= 80) {
                           attemptLinks.push(attemptHref);
                         }
                       }
                     });
                     console.log(`   📊 Tìm thấy ${attemptLinks.length} lượt bài làm đạt >80 điểm.`);
                   }
                } catch (reportErr) {
                  console.log(`   ℹ️ Không truy cập được báo cáo bài làm (Có thể tài khoản là sinh viên thường).`);
                }
              }

              if (attemptLinks.length === 0) {
                const attemptLink = $quizPage("a[href*='mod/quiz/review.php?attempt=']").first().attr("href");
                if (attemptLink) {
                  attemptLinks.push(attemptLink);
                  console.log(`   ℹ️ Fallback: lấy lượt làm bài duy nhất trong trang quiz.`);
                }
              }

              let uniqueAttempts = [...new Set(attemptLinks)];
              if (uniqueAttempts.length === 0) {
                console.log(`   ℹ️ Không có lượt bài làm nào đạt >80 điểm. Bỏ qua bài trắc nghiệm này.`);
                quizCount++;
                continue;
              }

              const maxAttemptsEnv = parseInt(process.env.LMS_MAX_ATTEMPTS, 10);
              const maxAttempts = !isNaN(maxAttemptsEnv) && maxAttemptsEnv > 0 ? maxAttemptsEnv : Infinity;
              if (uniqueAttempts.length > maxAttempts) {
                console.log(`   ℹ️ Giới hạn số lượt bài làm được phép tải xuống là ${maxAttempts} (tổng số tìm thấy: ${uniqueAttempts.length}).`);
                uniqueAttempts = uniqueAttempts.slice(0, maxAttempts);
              }

              console.log(`   🔎 Sẽ crawl ${uniqueAttempts.length} lượt bài làm đạt >80 điểm.`);

              for (let attIdx = 0; attIdx < uniqueAttempts.length; attIdx++) {
                const attemptUrl = uniqueAttempts[attIdx];
                const reviewUrl = attemptUrl.includes("showall=1") ? attemptUrl : `${attemptUrl}&showall=1`;
                console.log(`   🔎 Đang lấy câu hỏi từ lượt [${attIdx + 1}/${uniqueAttempts.length}]: ${reviewUrl}`);

                try {
                  const reviewRes = await getHtmlWithSso(reviewUrl);
                  const $review = cheerio.load(reviewRes.data);
                  const questionBlocks = $review(".que");

                  console.log(`      Found ${questionBlocks.length} questions.`);

                  // Process all questions using quiz-processor
                  const questionsToSave = await processQuizReview($review, questionBlocks, getCookieHeader);
                  
                  // Update multiple choice questions with quiz-extractor
                  for (let i = 0; i < questionsToSave.length; i++) {
                    const qData = questionsToSave[i];
                    if (qData.type === "multiple_choice" && !qData.answer) {
                      const qBlock = questionBlocks[qData.sourceQuestionIndex ?? i];
                      const { choices, choiceImgsList, rightAnswerText, ansImgsList } = await extractMultipleChoice($review, qBlock, getCookieHeader);
                      qData.choices = choices;
                      qData.answer = rightAnswerText;
                      qData.url_answer = ansImgsList.length > 0 ? ansImgsList.join(",") : null;
                      qData.url_choices = choiceImgsList.length > 0 ? choiceImgsList.join(",") : null;
                    }
                  }

                  // Save all extracted questions
                  for (let i = 0; i < questionsToSave.length; i++) {
                    const qData = questionsToSave[i];
                    
                    if (!qData.answer || qData.answer.trim() === "") {
                      console.log(`      ⚠️ Cảnh báo: Không lấy được đáp án đúng cho câu hỏi [${i + 1}] tại: ${reviewUrl}`);
                      console.log(`         Nội dung câu hỏi: "${qData.question.substring(0, 100)}..."`);
                      continue;
                    }

                    // Check if question already exists
                    const { data: existingQs } = await supabaseAdmin
                      .from("crawler_questions")
                      .select("id, answer")
                      .eq("course_id", dbCourse.id)
                      .eq("question", qData.question)
                      .limit(1);
                    const existingQ = existingQs && existingQs.length > 0 ? existingQs[0] : null;

                    if (existingQ && existingQ.answer && existingQ.answer.trim() !== "") {
                      console.log(`      ⏭️ Câu hỏi [${i + 1}] đã tồn tại trong DB và đã có đáp án. Bỏ qua.`);
                      continue;
                    }

                    if (existingQ) {
                      // For fill_blank questions, also update the question text with full context
                      if (qData.type === 'fill_blank') {
                        await supabaseAdmin
                          .from("crawler_questions")
                          .update({
                            question: qData.question,
                            answer: qData.answer,
                            url_answer: qData.url_answer
                          })
                          .eq("id", existingQ.id);
                        console.log(`      ✨ Đã cập nhật câu hỏi điền từ [${i + 1}] với context đầy đủ.`);
                      } else {
                        await supabaseAdmin
                          .from("crawler_questions")
                          .update({
                            answer: qData.answer,
                            url_answer: qData.url_answer
                          })
                          .eq("id", existingQ.id);
                        console.log(`      ✨ Đã cập nhật đáp án cho câu hỏi [${i + 1}] bị trống trước đó.`);
                      }
                    } else {
                      await supabaseAdmin.from("crawler_questions").insert({
                        course_id: dbCourse.id,
                        week_name: sectionName,
                        question: qData.question,
                        choices: qData.choices,
                        answer: qData.answer,
                        url_question: qData.url_question,
                        url_answer: qData.url_answer,
                        url_choices: qData.url_choices,
                        order_index: i + 1
                      });
                      console.log(`      ✅ Đã lưu câu hỏi mới [${i + 1}] (${qData.type}) (Đáp án: ${qData.answer}).`);
                    }
                  }
                } catch (revErr) {
                  console.log(`      ⚠️ Lỗi đọc lượt làm bài: ${revErr.message}`);
                }
              }
              quizCount++;
              console.log(`   ✅ Đã xử lý xong bài trắc nghiệm: "${activityName}"`);
            } catch (err) {
              console.log(`   ⚠️ Lỗi crawl trắc nghiệm "${activityName}": ${err.message}`);
            }
          }
        }
        sectionCrawledCount++;
      }
    }
      }
    }


    // Dọn dẹp Redis cache sau khi hoàn tất crawl
    console.log("\n🧹 Tiến hành dọn dẹp Redis cache...");
    await clearCache();

    console.log("\n=================================================");
    console.log("🎉 HOÀN THÀNH QUÁ TRÌNH CRAWL HỌC LIỆU LMS EHOU!");
    console.log("=================================================");

  } catch (err) {
    console.log(`\n❌ Lỗi nghiêm trọng trong quá trình chạy: ${err.message}`);
  } finally {
    rl.close();
  }
}

main();

function stripVietnameseDiacritics(str) {
  if (!str) return "";
  let s = String(str);
  try {
    if (s.normalize) s = s.normalize('NFD').replace(/\p{M}/gu, '');
  } catch (e) {
    s = s.replace(/[\u0300-\u036f]/g, '');
  }
  return s;
}

function normalizeTextForMatching(text) {
  if (!text) return '';
  try {
    let s = text.toString();
    s = s.replace(/[\u00A0\u2000-\u200B\uFEFF\u202F\xa0]/g, ' ');
    s = s.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, '');
    s = s.replace(/^[A-Za-z][\.\)](\S)/u, '$1');
    s = s.replace(/\n/g, ' ').replace(/[\s\t]+/g, ' ').replace(/[\s\xa0]{2,}/g, ' ').trim();
    s = s.replace(/^[\s\u2022•|]+|[\s\u2022•|]+$/g, '').trim();
    if (!/[._\u2026]{2,}\s*$/.test(s)) {
      s = s.replace(/[\u002e\u2026\-\–\—\s,;!\?\u2713\u2714]+$/g, '').trim();
    }
    return s;
  } catch (e) {
    let s = ('' + text).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*|^[0-9]{1,2}\s*[\.\)\-:\/]\s+/u, '');
    return s.replace(/[\.\u2026\-–—\s]+$/g, '').trim();
  }
}

function normalizeDetectedCourseTitle(raw) {
  let title = String(raw || "").trim();
  if (!title) return "";

  // Mẫu NEU: "Mon hoc_08032026"
  if (title.includes("_")) {
    const parts = title.split("_");
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].trim();
      if (/^\d+$/.test(lastPart)) {
        title = parts.slice(0, -1).join("_").trim();
      }
    }
  }

  // Chỉ lấy phần trước dấu "-" (ví dụ: "Lịch sử nhà nước và pháp luật - SL10.031" -> "Lịch sử nhà nước và pháp luật")
  if (title.includes("-") || title.includes("–") || title.includes("—")) {
    title = title.split(/[-–—]/)[0].trim();
  }

  return title.trim();
}

function isCourseTitleMatch(webTitle, docTitle) {
  const w = String(webTitle || "").toLowerCase().trim();
  const d = String(docTitle || "").toLowerCase().trim();
  if (w === d) return true;

  const cleanW = stripVietnameseDiacritics(w).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const cleanD = stripVietnameseDiacritics(d).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (cleanW === cleanD) return true;

  const getBaseAndNumbers = (str) => {
    const match = str.match(/^(.*?)\s*(\b\d+(?:[\s+,&/\\]+\d+)*\b)\s*$/);
    if (match) {
      const base = match[1].trim();
      const nums = match[2].match(/\d+/g) || [];
      return { base, nums };
    }
    return { base: str, nums: [] };
  };

  const parsedW = getBaseAndNumbers(cleanW);
  const parsedD = getBaseAndNumbers(cleanD);

  if (parsedW.base && parsedD.base && parsedW.base === parsedD.base) {
    if (parsedW.nums.length > 0 && parsedD.nums.length > 0) {
      const allNumsMatched = parsedW.nums.every(num => parsedD.nums.includes(num));
      if (allNumsMatched) return true;
    }
  }

  return cleanD.includes(cleanW) || cleanW.includes(cleanD);
}

function getCourseSimilarity(searchKeyword, courseTitle) {
  if (!searchKeyword || !courseTitle) return 0;

  const cleanTitle = (title) => {
    if (!title) return "";
    if (title.includes("-") || title.includes("–") || title.includes("—")) {
      return title.split(/[-–—]/)[0].trim();
    }
    return title.trim();
  };

  const cleanSearch = stripVietnameseDiacritics(searchKeyword).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const cleanCourse = stripVietnameseDiacritics(cleanTitle(courseTitle)).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  if (cleanCourse === cleanSearch) {
    return 1.0;
  }

  const searchWords = cleanSearch.split(/\s+/).filter(Boolean);
  const courseWords = cleanCourse.split(/\s+/).filter(Boolean);

  if (searchWords.length === 0) return 0;

  // Kiểm tra nếu chứa trực tiếp
  if (cleanCourse.includes(cleanSearch) || cleanSearch.includes(cleanCourse)) {
    const ratio = Math.min(searchWords.length, courseWords.length) / Math.max(searchWords.length, courseWords.length);
    return 0.8 + ratio * 0.19; // Trả về điểm từ 0.8 đến 0.99
  }

  let matchCount = 0;
  for (const word of searchWords) {
    if (courseWords.includes(word)) {
      matchCount++;
    }
  }

  return matchCount / searchWords.length;
}

function isCourseMatched(searchKeyword, courseTitle) {
  return getCourseSimilarity(searchKeyword, courseTitle) >= 0.75;
}
