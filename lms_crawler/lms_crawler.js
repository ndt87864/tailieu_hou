const readline = require("readline");
const axios = require("axios");
const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => {
  return new Promise((resolve) => rl.question(query, resolve));
};

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

let cookieJar = [];

function getCookieHeader() {
  return cookieJar.join("; ");
}

function updateCookies(setCookieHeaders) {
  if (!setCookieHeaders) return;
  for (const cookie of setCookieHeaders) {
    const parts = cookie.split(';');
    const mainCookie = parts[0].trim();
    if (mainCookie) {
      const [name] = mainCookie.split('=');
      cookieJar = cookieJar.filter(c => !c.startsWith(name + '='));
      cookieJar.push(mainCookie);
    }
  }
}

async function uploadFileToStorage(url, prefix) {
  const downloadRes = await axios.get(url, {
    headers: { Cookie: getCookieHeader() },
    responseType: "arraybuffer",
    timeout: 15000
  });

  let filename = `file_${Date.now()}`;
  const disposition = downloadRes.headers["content-disposition"];
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match) {
      filename = decodeURIComponent(match[1]).replace(/[/\\?%*:|"<>\s]/g, "_");
    }
  } else {
    const contentType = downloadRes.headers["content-type"] || "";
    if (contentType.includes("pdf")) filename += ".pdf";
    else if (contentType.includes("word") || contentType.includes("officedocument")) filename += ".docx";
    else if (contentType.includes("image")) {
      const ext = contentType.split("/")[1] || "png";
      filename += `.${ext}`;
    }
  }

  const storagePath = `${prefix}/${Date.now()}_${filename}`;
  const { error } = await supabaseAdmin.storage
    .from("lms-crawler-assets")
    .upload(storagePath, downloadRes.data, {
      contentType: downloadRes.headers["content-type"] || "application/octet-stream"
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("lms-crawler-assets")
    .getPublicUrl(storagePath);

  return publicUrl;
}

async function processHtmlImagesAndUpload(html) {
  if (!html) return { cleanHtml: "", uploadedUrls: [] };
  const $ = cheerio.load(html);
  const uploadedUrls = [];
  const imgs = $("img");

  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const src = $(img).attr("src");
    if (src && src.startsWith("http")) {
      try {
        const publicUrl = await uploadFileToStorage(src, "images");
        $(img).attr("src", publicUrl);
        uploadedUrls.push(publicUrl);
      } catch (err) {
        console.log(`   ⚠️ Không tải được ảnh: ${src}. Lỗi: ${err.message}`);
      }
    }
  }
  return {
    cleanHtml: $("body").html() || html,
    uploadedUrls
  };
}

function cleanQuestionText($, qtextEl) {
  const cloned = $(qtextEl).clone();
  cloned.find("script, style, .answer, label, .prompt, .accesshide, .feedback, .generalfeedback").remove();
  cloned.find("img").remove();
  
  let questionText = cloned.text().replace(/\s+/g, " ").trim();
  
  questionText = questionText
    .replace(/^mô tả câu hỏi/i, "")
    .replace(/^câu hỏi \d+\s*chưa trả lời/i, "")
    .replace(/^câu hỏi \d+\s*đạt điểm\s*[\d\.,]+/i, "")
    .trim();
    
  const instructions = [
    /chọn một câu trả lời:?/i,
    /chọn một:?/i,
    /chọn câu trả lời:?/i,
    /chọn đáp án:?/i,
    /trả lời câu hỏi:?/i,
    /\b[a-fA-F][\.\)]\s*$/i
  ];
  instructions.forEach(regex => {
    questionText = questionText.replace(regex, "").trim();
  });
  
  const optIndex = questionText.search(/\b[aA][\.\)]\s+/);
  if (optIndex !== -1 && optIndex > 10) {
    questionText = questionText.substring(0, optIndex).trim();
  }
  
  return questionText;
}

async function getHtmlWithSso(url) {
  let currentUrl = url;
  let response;
  let redirectsCount = 0;

  while (redirectsCount < 10) {
    try {
      response = await axios.get(currentUrl, {
        headers: {
          "Cookie": getCookieHeader(),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
    } catch (err) {
      if (err.response) {
        response = err.response;
      } else {
        throw err;
      }
    }

    updateCookies(response.headers["set-cookie"]);
    console.log(`    ➡️ [SSO DEBUG] GET -> ${currentUrl} | Status: ${response.status}`);

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      currentUrl = response.headers.location;
      redirectsCount++;
    } else {
      break;
    }
  }
  return response;
}

async function postHtmlWithSso(url, data) {
  let currentUrl = url;
  let response;
  let redirectsCount = 0;
  let method = "POST";
  let requestData = data;

  while (redirectsCount < 10) {
    try {
      const config = {
        headers: {
          "Cookie": getCookieHeader(),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      };

      if (method === "POST") {
        config.headers["Content-Type"] = "application/x-www-form-urlencoded";
        response = await axios.post(currentUrl, requestData, config);
      } else {
        response = await axios.get(currentUrl, config);
      }
    } catch (err) {
      if (err.response) {
        response = err.response;
      } else {
        throw err;
      }
    }

    updateCookies(response.headers["set-cookie"]);
    console.log(`    ➡️ [SSO DEBUG] ${method} -> ${currentUrl} | Status: ${response.status}`);

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      currentUrl = response.headers.location;
      method = "GET";
      requestData = null;
      redirectsCount++;
    } else {
      break;
    }
  }
  return response;
}

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

    console.log("\n📡 Đang tải danh sách tài liệu từ Database...");
    const { data: docs, error: docErr } = await supabaseAdmin
      .from("documents")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(30);

    if (docErr || !docs || docs.length === 0) {
      console.log("❌ Không tải được danh sách tài liệu hoặc DB trống!");
      rl.close();
      return;
    }

    let selectedDoc = null;
    const envDocTitle = (process.env.LMS_DOCUMENT_TITLE || "").trim();
    if (envDocTitle) {
      const { data: foundDocs } = await supabaseAdmin
        .from("documents")
        .select("id, title")
        .ilike("title", `%${envDocTitle}%`);

      if (foundDocs && foundDocs.length > 0) {
        selectedDoc = foundDocs[0];
        console.log(`\n✅ Tự động chọn tài liệu đối chiếu từ env: "${selectedDoc.title}"`);
      } else {
        console.log(`\n🆕 Không tìm thấy tài liệu "${envDocTitle}" trong database. Tiến hành tạo mới...`);
        const { data: newDoc, error: insErr } = await supabaseAdmin
          .from("documents")
          .insert({ title: envDocTitle })
          .select()
          .single();
        if (insErr) {
          throw new Error(`Không thể tạo tài liệu mới: ${insErr.message}`);
        }
        selectedDoc = newDoc;
        console.log(`✅ Đã tạo mới tài liệu đối chiếu: "${selectedDoc.title}"`);
      }
    }

    if (!selectedDoc) {
      console.log("\nDanh sách tài liệu đối chiếu gần đây:");
      docs.forEach((doc, idx) => {
        console.log(`[${idx + 1}] ${doc.title}`);
      });

      const userInput = await askQuestion(`\n👉 Nhập tên tài liệu đối chiếu (hoặc chọn số thứ tự 1-${docs.length}): `);
      const trimmedInput = userInput.trim();
      const numIdx = parseInt(trimmedInput, 10) - 1;

      if (!isNaN(numIdx) && numIdx >= 0 && numIdx < docs.length) {
        selectedDoc = docs[numIdx];
        console.log(`\n✅ Bạn đã chọn tài liệu đối chiếu: "${selectedDoc.title}"`);
      } else if (trimmedInput.length > 0) {
        const { data: foundDocs } = await supabaseAdmin
          .from("documents")
          .select("id, title")
          .ilike("title", `%${trimmedInput}%`);

        if (foundDocs && foundDocs.length > 0) {
          selectedDoc = foundDocs[0];
          console.log(`\n✅ Chọn tài liệu đối chiếu khớp tìm kiếm: "${selectedDoc.title}"`);
        } else {
          console.log(`\n🆕 Không tìm thấy tài liệu "${trimmedInput}" trong database. Tiến hành tạo mới...`);
          const { data: newDoc, error: insErr } = await supabaseAdmin
            .from("documents")
            .insert({ title: trimmedInput })
            .select()
            .single();
          if (insErr) {
            throw new Error(`Không thể tạo tài liệu mới: ${insErr.message}`);
          }
          selectedDoc = newDoc;
          console.log(`✅ Đã tạo mới tài liệu đối chiếu: "${selectedDoc.title}"`);
        }
      } else {
        console.log("❌ Lựa chọn không hợp lệ!");
        rl.close();
        return;
      }
    }

    let isTestMode = true;
    const envTestMode = process.env.LMS_TEST_MODE;
    if (envTestMode !== undefined && envTestMode !== "") {
      isTestMode = envTestMode.trim().toLowerCase() === "true";
      console.log(`ℹ️ Tự động nhận diện chế độ chạy từ env: ${isTestMode ? "TEST (Giới hạn 1 mẫu)" : "FULL"}`);
    } else {
      const testModeStr = await askQuestion("🧪 Bạn có muốn chạy ở chế độ TEST (chỉ crawl thử nghiệm 1 file, 1 youtube, 1 thông báo và 1 câu hỏi đầu tiên)? (Y/n): ");
      isTestMode = testModeStr.toLowerCase() !== "n";
      console.log(`ℹ️ Đang chạy ở chế độ: ${isTestMode ? "TEST (Giới hạn 1 mẫu)" : "FULL"}`);
    }

    console.log("\n🔑 Đang kết nối tới Moodle LMS learning.ehou.edu.vn...");
    const loginUrl = "https://learning.ehou.edu.vn/login/index.php";

    const res1 = await getHtmlWithSso(loginUrl);

    const $1 = cheerio.load(res1.data);
    const lt = $1('input[name="lt"]').val();
    const execution = $1('input[name="execution"]').val();

    let loginRes;
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

    const dashRes = await getHtmlWithSso("https://learning.ehou.edu.vn/my/");
    const $dash = cheerio.load(dashRes.data);
    if ($dash('a[href*="login/logout.php"]').length === 0 && $dash(".usermenu, .userbutton, .avatars").length === 0) {
      throw new Error("Đăng nhập thất bại! Vui lòng kiểm tra lại tài khoản & mật khẩu.");
    }
    console.log("✅ Đăng nhập LMS thành công!");

    console.log(`🔍 Đang tìm môn học khớp với tài liệu: "${selectedDoc.title}"...`);
    const searchUrl = `https://learning.ehou.edu.vn/course/search.php?search=${encodeURIComponent(selectedDoc.title)}`;
    const searchRes = await getHtmlWithSso(searchUrl);
    const $search = cheerio.load(searchRes.data);
    const courseLink = $search(".coursebox .coursename a").first().attr("href");

    if (!courseLink) {
      throw new Error(`Không tìm thấy môn học nào trên LMS khớp với tài liệu: "${selectedDoc.title}"`);
    }

    const courseTitle = $search(".coursebox .coursename a").first().text().trim();
    const courseIdMatch = courseLink.match(/id=(\d+)/);
    const moodleCourseId = courseIdMatch ? courseIdMatch[1] : "";
    console.log(`📚 Đã tìm thấy môn học: "${courseTitle}" (LMS ID: ${moodleCourseId})`);

    const { data: dbCourse, error: courseErr } = await supabaseAdmin.from("crawler_courses").insert({
      document_id: selectedDoc.id,
      moodle_course_id: moodleCourseId,
      title: courseTitle,
      url: courseLink
    }).select().single();

    if (courseErr || !dbCourse) {
      throw new Error(`Không lưu được môn học vào DB: ${courseErr ? courseErr.message : ""}`);
    }
    console.log("💾 Đã lưu thông tin môn học vào DB.");

    console.log(`\n🌐 Đang tải cấu trúc môn học từ: ${courseLink}...`);
    const courseRes = await getHtmlWithSso(courseLink);
    const $course = cheerio.load(courseRes.data);

    // Thu thập toàn bộ section ID của các tuần học
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
        console.log(`\n-------------------------------------------------`);
        console.log(`📖 Đang crawl tuần/phần: "${sectionName}"`);
        console.log(`-------------------------------------------------`);

        const activities = $secPage(sec).find("li.activity");
        for (let a = 0; a < activities.length; a++) {
          const act = activities[a];
          const activityName = $secPage(act).find(".instancename").text().trim().replace(/File|URL|Quiz|Page|Forum/g, "").trim();
          const href = $secPage(act).find("a").attr("href");

          if (!href) continue;

          if (href.includes("mod/resource/view.php")) {
            if (isTestMode && fileCount >= 1) {
              continue;
            }
            try {
              console.log(`   📎 Đang tải file tài liệu: "${activityName}"...`);
              const filePublicUrl = await uploadFileToStorage(href, "files");
              await supabaseAdmin.from("crawler_resources").insert({
                course_id: dbCourse.id,
                type: "file",
                title: activityName,
                content_url: filePublicUrl,
                week_name: sectionName
              });
              fileCount++;
              console.log(`   ✅ Đã tải & lưu file thành công.`);
            } catch (err) {
              console.log(`   ⚠️ Lỗi tải file: ${err.message}`);
            }
          }

          else if (href.includes("mod/url/view.php")) {
            if (isTestMode && youtubeCount >= 1) {
              continue;
            }
            try {
              console.log(`   🎥 Đang trích xuất link bài giảng: "${activityName}"...`);
              const urlRes = await getHtmlWithSso(href);
              const $urlPage = cheerio.load(urlRes.data);
              const finalUrl = $urlPage(".urlworkaround a").attr("href") || $urlPage("iframe").attr("src") || href;

              await supabaseAdmin.from("crawler_resources").insert({
                course_id: dbCourse.id,
                type: "youtube",
                title: activityName,
                content_url: finalUrl,
                week_name: sectionName
              });
              youtubeCount++;
              console.log(`   ✅ Đã lưu link video: ${finalUrl}`);
            } catch (err) {
              console.log(`   ⚠️ Lỗi trích xuất link: ${err.message}`);
            }
          }

          else if (href.includes("mod/page/view.php")) {
            try {
              console.log(`   📄 Phát hiện trang nội dung/bài giảng: "${activityName}"...`);
              const pageRes = await getHtmlWithSso(href);
              const $page = cheerio.load(pageRes.data);
              
              const iframeSrc = $page("iframe[src*='youtube.com'], iframe[src*='youtu.be']").first().attr("src");
              if (iframeSrc) {
                if (isTestMode && youtubeCount >= 1) {
                  continue;
                }
                await supabaseAdmin.from("crawler_resources").insert({
                  course_id: dbCourse.id,
                  type: "youtube",
                  title: activityName,
                  content_url: iframeSrc,
                  week_name: sectionName
                });
                youtubeCount++;
                console.log(`   ✅ Đã trích xuất link video từ Page: ${iframeSrc}`);
              } else {
                const pageContent = $page(".no-overflow, #region-main").html() || "";
                const { cleanHtml: cleanPageContent } = await processHtmlImagesAndUpload(pageContent);
                
                await supabaseAdmin.from("crawler_resources").insert({
                  course_id: dbCourse.id,
                  type: "announcement",
                  title: activityName,
                  raw_content: cleanPageContent,
                  week_name: sectionName
                });
                console.log(`   ✅ Đã lưu nội dung văn bản của Page.`);
              }
            } catch (err) {
              console.log(`   ⚠️ Lỗi trích xuất trang Page: ${err.message}`);
            }
          }

          else if (href.includes("mod/quiz/view.php")) {
            if (isTestMode && quizCount >= 1) {
              continue;
            }
            try {
              console.log(`   📝 Phát hiện bài trắc nghiệm: "${activityName}"...`);
              const quizRes = await getHtmlWithSso(href);
              const $quizPage = cheerio.load(quizRes.data);

              const quizIdMatch = href.match(/id=(\d+)/);
              const quizId = quizIdMatch ? quizIdMatch[1] : "";

              // 1. Quét report overview lấy tất cả các attempts
              const attemptLinks = [];
              if (quizId) {
                const reportUrl = `https://learning.ehou.edu.vn/mod/quiz/report.php?id=${quizId}&mode=overview`;
                console.log(`   🔍 Quét danh sách bài làm của mọi sinh viên từ: ${reportUrl}`);
                try {
                  const reportRes = await getHtmlWithSso(reportUrl);
                  const $reportPage = cheerio.load(reportRes.data);
                  $reportPage("a[href*='mod/quiz/review.php?attempt=']").each((i, el) => {
                    attemptLinks.push($reportPage(el).attr("href"));
                  });
                } catch (reportErr) {
                  console.log(`   ℹ️ Không truy cập được báo cáo bài làm (Có thể tài khoản là sinh viên thường).`);
                }
              }

              // 2. Fallback lấy lượt làm bài của cá nhân
              if (attemptLinks.length === 0) {
                const attemptLink = $quizPage("a[href*='mod/quiz/review.php?attempt=']").first().attr("href");
                if (attemptLink) {
                  attemptLinks.push(attemptLink);
                }
              }

              let uniqueAttempts = [...new Set(attemptLinks)];
              if (isTestMode && uniqueAttempts.length > 0) {
                uniqueAttempts = [uniqueAttempts[0]]; // Chỉ lấy 1 attempt đầu tiên khi TEST
              }
              console.log(`   📊 Tìm thấy ${uniqueAttempts.length} lượt bài làm để crawl câu hỏi.`);

              for (let attIdx = 0; attIdx < uniqueAttempts.length; attIdx++) {
                const attemptUrl = uniqueAttempts[attIdx];
                const reviewUrl = attemptUrl.includes("showall=1") ? attemptUrl : `${attemptUrl}&showall=1`;
                console.log(`   🔎 Đang lấy câu hỏi từ lượt [${attIdx + 1}/${uniqueAttempts.length}]: ${reviewUrl}`);

                try {
                  const reviewRes = await getHtmlWithSso(reviewUrl);
                  const $review = cheerio.load(reviewRes.data);
                  const questionBlocks = $review(".que");

                  console.log(`      Found ${questionBlocks.length} questions.`);

                  for (let q = 0; q < questionBlocks.length; q++) {
                    const qBlock = questionBlocks[q];
                    const qtextEl = $review(qBlock).find(".qtext");
                    const qTextHtml = qtextEl.html() || "";

                    const { cleanHtml: qTextCleanHtml, uploadedUrls: qImgs } = await processHtmlImagesAndUpload(qTextHtml);
                    const $tempQ = cheerio.load(qTextCleanHtml);
                    const qTextClean = cleanQuestionText($tempQ, $tempQ("body"));

                    const choices = [];
                    const choiceImgsList = [];
                    const choiceBlocks = $review(qBlock).find(".answer div[class*='r0'], .answer div[class*='r1']");
                    for (let c = 0; c < choiceBlocks.length; c++) {
                      const imgTags = $review(choiceBlocks[c]).find("img");
                      for (let i = 0; i < imgTags.length; i++) {
                        const src = $review(imgTags[i]).attr("src");
                        if (src && !src.includes("grade_")) {
                          try {
                            const publicUrl = await uploadFileToStorage(src, "images");
                            choiceImgsList.push(publicUrl);
                          } catch (e) {}
                        }
                      }

                      const choiceHtml = $review(choiceBlocks[c]).html() || "";
                      const { cleanHtml: choiceClean } = await processHtmlImagesAndUpload(choiceHtml);
                      const $temp = cheerio.load(choiceClean);
                      $temp("input, span.control").remove();
                      choices.push($temp.text().trim());
                    }

                    let rightAnswerText = "";
                    const ansImgsList = [];
                    let rightAnswerBlock = $review(qBlock).find(".rightanswer");
                    if (rightAnswerBlock.length === 0) {
                      rightAnswerBlock = $review(qBlock).find(".outcome");
                    }
                    if (rightAnswerBlock.length > 0) {
                      const imgTags = rightAnswerBlock.find("img");
                      for (let i = 0; i < imgTags.length; i++) {
                        const src = $review(imgTags[i]).attr("src");
                        if (src && !src.includes("grade_")) {
                          try {
                            const publicUrl = await uploadFileToStorage(src, "images");
                            ansImgsList.push(publicUrl);
                          } catch (e) {}
                        }
                      }

                      const clonedBlock = rightAnswerBlock.clone();
                      clonedBlock.find(".feedback, .generalfeedback, .accesshide").remove();
                      const rawAns = clonedBlock.text().trim();
                      const match = rawAns.match(/(?:Đáp án đúng là:|The correct answer is:|Câu trả lời đúng là:|The correct answers are:|Các đáp án đúng là:)\s*(.*)/i);
                      rightAnswerText = match ? match[1].trim() : rawAns;
                      rightAnswerText = rightAnswerText.replace(/[\u2713\u2714\u2611\u2705]/g, "").trim();
                    }

                    if (!rightAnswerText) {
                      const choiceBlocks2 = $review(qBlock).find(".answer div[class*='r0'], .answer div[class*='r1']");
                      for (let c = 0; c < choiceBlocks2.length; c++) {
                        const choiceEl = choiceBlocks2[c];
                        const hasCorrectClass = $review(choiceEl).hasClass("correct") || $review(choiceEl).find(".correct").length > 0;
                        const correctnessIcon = $review(choiceEl).find(".questioncorrectnessicon, img[src*='grade_correct'], img[src*='grade_']");
                        let hasCorrectIcon = false;
                        if (correctnessIcon.length > 0) {
                          const alt = (correctnessIcon.attr("alt") || "").toLowerCase();
                          const title = (correctnessIcon.attr("title") || "").toLowerCase();
                          const src = (correctnessIcon.attr("src") || "").toLowerCase();
                          const isCorrectText = (text) => {
                            if (!text) return false;
                            if (text.includes("không") || text.includes("incorrect")) return false;
                            return text.includes("đúng") || text.includes("correct");
                          };
                          hasCorrectIcon = isCorrectText(alt) || isCorrectText(title) || src.includes("grade_correct");
                        }
                        const text = $review(choiceEl).text() || "";
                        const hasTickChar = /[✓✔✅]/.test(text);

                        if (hasCorrectClass || hasCorrectIcon || hasTickChar) {
                          const temp = $review(choiceEl).clone();
                          temp.find("input, span.control, .questioncorrectnessicon").remove();
                          rightAnswerText = temp.text().trim();
                          rightAnswerText = rightAnswerText.replace(/^[a-zA-Z]\s*[\.\)\-:\/]\s*/u, "").trim();
                          break;
                        }
                      }
                    }

                    const url_question = qImgs.length > 0 ? qImgs.join(",") : null;
                    const url_answer = ansImgsList.length > 0 ? ansImgsList.join(",") : null;
                    const url_choices = choiceImgsList.length > 0 ? choiceImgsList.join(",") : null;

                    await supabaseAdmin.from("crawler_questions").insert({
                      course_id: dbCourse.id,
                      week_name: sectionName,
                      question: qTextClean,
                      choices,
                      answer: rightAnswerText,
                      url_question,
                      url_answer,
                      url_choices,
                      order_index: q + 1
                    });
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
      }
    }

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
