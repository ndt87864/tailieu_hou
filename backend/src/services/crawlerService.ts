import axios from "axios";
import * as cheerio from "cheerio";
import { supabaseAdmin } from "../config/db.js";

export interface CrawlerProgress {
  status: "idle" | "running" | "completed" | "failed";
  logs: string[];
  currentStep: string;
  percent: number;
}

let activeProgress: CrawlerProgress = {
  status: "idle",
  logs: [],
  currentStep: "",
  percent: 0,
};

export const getCrawlerStatus = () => activeProgress;

let cookieJar: string[] = [];

function getCookieHeader(): string {
  return cookieJar.join("; ");
}

function updateCookies(setCookieHeaders: string[] | undefined) {
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

async function uploadFileToStorage(url: string, prefix: string): Promise<string> {
  const downloadRes = await axios.get(url, {
    headers: { Cookie: getCookieHeader() },
    responseType: "arraybuffer",
    timeout: 10000
  });

  let filename = `file_${Date.now()}`;
  const disposition = downloadRes.headers["content-disposition"];
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match) {
      filename = decodeURIComponent(match[1]).replace(/[/\\?%*:|"<>\s]/g, "_");
    }
  } else {
    // Thử đoán đuôi file từ content-type
    const contentType = downloadRes.headers["content-type"] || "";
    if (contentType.includes("pdf")) filename += ".pdf";
    else if (contentType.includes("word") || contentType.includes("officedocument")) filename += ".docx";
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

async function processHtmlImagesAndUpload(html: string): Promise<{ cleanHtml: string; uploadedUrls: string[] }> {
  if (!html) return { cleanHtml: "", uploadedUrls: [] };
  const $ = cheerio.load(html);
  const uploadedUrls: string[] = [];
  const imgs = $("img");

  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const src = $(img).attr("src");
    if (src && src.startsWith("http")) {
      try {
        const publicUrl = await uploadFileToStorage(src, "images");
        $(img).attr("src", publicUrl);
        uploadedUrls.push(publicUrl);
      } catch (err: any) {
        activeProgress.logs.push(`⚠️ Không tải được ảnh: ${src}. Lỗi: ${err.message}`);
      }
    }
  }
  return {
    cleanHtml: $("body").html() || html,
    uploadedUrls
  };
}

export const startCrawlerBackground = async (username: string, password: string, documentId: string) => {
  if (activeProgress.status === "running") {
    throw new Error("Crawler đang chạy rồi.");
  }

  activeProgress = {
    status: "running",
    logs: ["🚀 Bắt đầu quá trình Crawl LMS EHOU..."],
    currentStep: "Đăng nhập",
    percent: 5,
  };

  // Run in background
  (async () => {
    try {
      cookieJar = [];
      const loginUrl = "https://learning.ehou.edu.vn/login/index.php";

      activeProgress.logs.push("🔑 GET trang đăng nhập để lấy token...");
      const res1 = await axios.get(loginUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      updateCookies(res1.headers["set-cookie"]);

      const $1 = cheerio.load(res1.data);
      const logintoken = $1('input[name="logintoken"]').val();

      if (!logintoken) {
        throw new Error("Không tìm thấy logintoken trên trang đăng nhập LMS.");
      }

      activeProgress.logs.push(`🔑 Gửi thông tin đăng nhập cho tài khoản: ${username}...`);
      const res2 = await axios.post(loginUrl, new URLSearchParams({
        username,
        password,
        logintoken: logintoken as string
      }).toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": getCookieHeader(),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
      updateCookies(res2.headers["set-cookie"]);

      // Thử GET trang dashboard để xác thực đăng nhập thành công
      activeProgress.logs.push("🛡️ Kiểm tra trạng thái đăng nhập...");
      const dashRes = await axios.get("https://learning.ehou.edu.vn/my/", {
        headers: { "Cookie": getCookieHeader(), "User-Agent": "Mozilla/5.0" }
      });
      const $dash = cheerio.load(dashRes.data);
      const userMenu = $dash(".usermenu, .userbutton");
      if (userMenu.length === 0) {
        throw new Error("Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản và mật khẩu.");
      }
      activeProgress.logs.push("✅ Đăng nhập thành công!");
      activeProgress.percent = 15;

      // Tìm kiếm môn học
      activeProgress.currentStep = "Tìm kiếm môn học";
      const docRes = await supabaseAdmin.from("documents").select("title").eq("id", documentId).single();
      if (!docRes.data) {
        throw new Error("Không tìm thấy tài liệu tương ứng trong DB của bạn.");
      }
      const documentTitle = docRes.data.title;
      activeProgress.logs.push(`🔍 Tìm kiếm môn học theo tài liệu: "${documentTitle}"...`);

      const searchUrl = `https://learning.ehou.edu.vn/course/search.php?search=${encodeURIComponent(documentTitle)}`;
      const searchRes = await axios.get(searchUrl, {
        headers: { "Cookie": getCookieHeader(), "User-Agent": "Mozilla/5.0" }
      });
      const $search = cheerio.load(searchRes.data);
      const courseLink = $search(".coursebox .coursename a").first().attr("href");

      if (!courseLink) {
        throw new Error(`Không tìm thấy môn học nào trên LMS khớp với tài liệu: "${documentTitle}"`);
      }

      const courseTitle = $search(".coursebox .coursename a").first().text().trim();
      const courseIdMatch = courseLink.match(/id=(\d+)/);
      const moodleCourseId = courseIdMatch ? courseIdMatch[1] : "";
      activeProgress.logs.push(`📚 Tìm thấy môn học: "${courseTitle}" (ID: ${moodleCourseId})`);
      activeProgress.percent = 30;

      // Lưu crawler_courses
      const { data: dbCourse, error: courseErr } = await supabaseAdmin.from("crawler_courses").insert({
        document_id: documentId,
        moodle_course_id: moodleCourseId,
        title: courseTitle,
        url: courseLink
      }).select().single();

      if (courseErr || !dbCourse) {
        throw new Error(`Không lưu được môn học vào database: ${courseErr?.message}`);
      }

      // Vào trang môn học
      activeProgress.currentStep = "Crawl nội dung môn học";
      activeProgress.logs.push(`🌐 Đang mở trang môn học: ${courseLink}...`);
      const courseRes = await axios.get(courseLink, {
        headers: { "Cookie": getCookieHeader(), "User-Agent": "Mozilla/5.0" }
      });
      const $course = cheerio.load(courseRes.data);

      const sections = $course("li.section.main");
      activeProgress.logs.push(`📅 Tìm thấy ${sections.length} phần học/tuần học.`);

      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        const sectionName = $course(sec).find(".sectionname, .section-title, h3").first().text().trim() || `Phần ${s + 1}`;
        activeProgress.logs.push(`📖 Đang crawl: "${sectionName}"...`);

        const activities = $course(sec).find("li.activity");
        for (let a = 0; a < activities.length; a++) {
          const act = activities[a];
          const activityName = $course(act).find(".instancename").text().trim().replace(/File|URL|Quiz|Page|Forum/g, "").trim();
          const href = $course(act).find("a").attr("href");

          if (!href) continue;

          // 1. Dạng File tài liệu
          if (href.includes("mod/resource/view.php")) {
            try {
              activeProgress.logs.push(`   📎 Đang tải tài liệu: "${activityName}"...`);
              const filePublicUrl = await uploadFileToStorage(href, "files");
              await supabaseAdmin.from("crawler_resources").insert({
                course_id: dbCourse.id,
                type: "file",
                title: activityName,
                content_url: filePublicUrl,
                week_name: sectionName
              });
              activeProgress.logs.push(`   ✅ Đã tải & lưu file lên Storage.`);
            } catch (err: any) {
              activeProgress.logs.push(`   ⚠️ Lỗi tải file "${activityName}": ${err.message}`);
            }
          }

          // 2. Dạng Link bài giảng / Video Youtube
          else if (href.includes("mod/url/view.php")) {
            try {
              activeProgress.logs.push(`   🎥 Đang trích xuất link bài giảng: "${activityName}"...`);
              const urlRes = await axios.get(href, {
                headers: { "Cookie": getCookieHeader(), "User-Agent": "Mozilla/5.0" }
              });
              const $urlPage = cheerio.load(urlRes.data);
              const finalUrl = $urlPage(".urlworkaround a").attr("href") || $urlPage("iframe").attr("src") || href;

              await supabaseAdmin.from("crawler_resources").insert({
                course_id: dbCourse.id,
                type: "youtube",
                title: activityName,
                content_url: finalUrl,
                week_name: sectionName
              });
              activeProgress.logs.push(`   ✅ Đã lưu link: ${finalUrl}`);
            } catch (err: any) {
              activeProgress.logs.push(`   ⚠️ Lỗi trích xuất link "${activityName}": ${err.message}`);
            }
          }

          // 3. Trắc nghiệm (Quiz)
          else if (href.includes("mod/quiz/view.php")) {
            try {
              activeProgress.logs.push(`   📝 Phát hiện bài trắc nghiệm: "${activityName}"...`);
              const quizRes = await axios.get(href, {
                headers: { "Cookie": getCookieHeader(), "User-Agent": "Mozilla/5.0" }
              });
              const $quizPage = cheerio.load(quizRes.data);

              // Tìm các link xem lại kết quả làm bài trước
              const attemptLink = $quizPage("a[href*='mod/quiz/review.php?attempt=']").first().attr("href");
              if (!attemptLink) {
                activeProgress.logs.push(`   ℹ️ Không tìm thấy lượt làm bài trước để review câu hỏi của: "${activityName}"`);
                continue;
              }

              // Chuẩn hóa link review để hiển thị tất cả câu hỏi
              const reviewUrl = attemptLink.includes("showall=1") ? attemptLink : `${attemptLink}&showall=1`;
              activeProgress.logs.push(`   🔍 Đang lấy câu hỏi từ review: ${reviewUrl}`);

              const reviewRes = await axios.get(reviewUrl, {
                headers: { "Cookie": getCookieHeader(), "User-Agent": "Mozilla/5.0" }
              });
              const $review = cheerio.load(reviewRes.data);
              const questionBlocks = $review(".que");

              activeProgress.logs.push(`   📊 Tìm thấy ${questionBlocks.length} câu hỏi.`);

              for (let q = 0; q < questionBlocks.length; q++) {
                const qBlock = questionBlocks[q];
                const qTextHtml = $review(qBlock).find(".qtext").html() || "";

                // Xử lý ảnh trong câu hỏi
                const { cleanHtml: qTextClean, uploadedUrls: qImgs } = await processHtmlImagesAndUpload(qTextHtml);

                // Lấy các lựa chọn
                const choices: string[] = [];
                const choiceBlocks = $review(qBlock).find(".answer div[class*='r0'], .answer div[class*='r1']");
                for (let c = 0; c < choiceBlocks.length; c++) {
                  const choiceHtml = $review(choiceBlocks[c]).html() || "";
                  const { cleanHtml: choiceClean } = await processHtmlImagesAndUpload(choiceHtml);
                  // Lọc bớt thẻ input/radio chỉ lấy phần text và ảnh hiển thị
                  const $temp = cheerio.load(choiceClean);
                  $temp("input, span.control").remove();
                  choices.push($temp.text().trim());
                }

                // Lấy đáp án đúng
                let rightAnswerText = "";
                const rightAnswerBlock = $review(qBlock).find(".rightanswer, .outcome");
                if (rightAnswerBlock.length > 0) {
                  const rawAns = rightAnswerBlock.text().trim();
                  // Thường có dạng "The correct answer is: A" hoặc "Đáp án đúng là: B"
                  const match = rawAns.match(/(?:Đáp án đúng là:|The correct answer is:)\s*(.*)/i);
                  rightAnswerText = match ? match[1].trim() : rawAns;
                }

                // Lưu vào database
                await supabaseAdmin.from("crawler_questions").insert({
                  course_id: dbCourse.id,
                  week_name: sectionName,
                  question: qTextClean,
                  choices,
                  answer: rightAnswerText,
                  image_urls: qImgs
                });
              }
              activeProgress.logs.push(`   ✅ Đã crawl xong bài trắc nghiệm: "${activityName}"`);
            } catch (err: any) {
              activeProgress.logs.push(`   ⚠️ Lỗi crawl trắc nghiệm "${activityName}": ${err.message}`);
            }
          }
        }
        activeProgress.percent = Math.min(95, 30 + Math.floor((s + 1) / sections.length * 65));
      }

      activeProgress.status = "completed";
      activeProgress.percent = 100;
      activeProgress.logs.push("🎉 Quá trình Crawl dữ liệu LMS EHOU hoàn thành xuất sắc!");
    } catch (error: any) {
      console.error("Lỗi Crawler:", error);
      activeProgress.status = "failed";
      activeProgress.logs.push(`❌ Lỗi nghiêm trọng: ${error.message}`);
    }
  })();
};
