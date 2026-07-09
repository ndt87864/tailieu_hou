const readline = require("readline");
const cheerio = require("cheerio");
const { supabaseAdmin, processHtmlImagesAndUpload, cleanQuestionText, uploadFileToStorage } = require("./utils/db");
const { getHtmlWithSso, postHtmlWithSso, getCookieHeader } = require("./utils/sso");
require("dotenv").config();

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

    console.log(`🔍 Đang tìm môn học khớp với tài liệu: "${selectedDoc.title}"...`);
    const searchUrl = `https://learning.ehou.edu.vn/course/search.php?search=${encodeURIComponent(selectedDoc.title)}`;
    const searchRes = await getHtmlWithSso(searchUrl);
    const $search = cheerio.load(searchRes.data);

    const courseLinkEl = $search(".coursebox .coursename a").first();
    const courseLink = courseLinkEl.attr("href");
    const courseTitle = courseLinkEl.text().trim();

    if (!courseLink) {
      throw new Error(`Không tìm thấy môn học nào khớp với tài liệu đối chiếu: "${selectedDoc.title}"`);
    }

    const moodleCourseIdMatch = courseLink.match(/id=(\d+)/);
    const moodleCourseId = moodleCourseIdMatch ? moodleCourseIdMatch[1] : "";
    console.log(`📚 Đã tìm thấy môn học: "${courseTitle}" (LMS ID: ${moodleCourseId})`);

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

    const isResourceExists = async (title, type, weekName) => {
      const { data } = await supabaseAdmin
        .from("crawler_resources")
        .select("id")
        .eq("course_id", dbCourse.id)
        .eq("title", title)
        .eq("type", type)
        .eq("week_name", weekName)
        .limit(1);
      return data && data.length > 0;
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
              if (await isResourceExists(activityName, "file", sectionName)) {
                console.log(`   ⏭️ File "${activityName}" đã tồn tại trong DB. Bỏ qua.`);
                fileCount++;
                continue;
              }
              console.log(`   📎 Đang tải file tài liệu: "${activityName}"...`);
              const filePublicUrl = await uploadFileToStorage(href, "files", getCookieHeader);
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
              if (await isResourceExists(activityName, "youtube", sectionName)) {
                console.log(`   ⏭️ Video "${activityName}" đã tồn tại trong DB. Bỏ qua.`);
                youtubeCount++;
                continue;
              }
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
              const isYtExists = await isResourceExists(activityName, "youtube", sectionName);
              const isAnnExists = await isResourceExists(activityName, "announcement", sectionName);
              if (isYtExists || isAnnExists) {
                console.log(`   ⏭️ Trang Page "${activityName}" đã tồn tại trong DB. Bỏ qua.`);
                if (isYtExists) youtubeCount++;
                continue;
              }

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
                const { cleanHtml: cleanPageContent } = await processHtmlImagesAndUpload(pageContent, getCookieHeader);
                
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

              const attemptLinks = [];
              if (quizId) {
                const reportUrl = `https://learning.ehou.edu.vn/mod/quiz/report.php?id=${quizId}&mode=overview`;
                console.log(`   🔍 Quét danh sách bài làm của mọi sinh viên từ: ${reportUrl}`);
                try {
                  const reportRes = await getHtmlWithSso(reportUrl);
                  const $reportPage = cheerio.load(reportRes.data);

                  // Nếu trang chỉ hiển thị biểu đồ phân phối điểm (không có bảng bài làm cá nhân)
                  // thì bỏ qua, không thể lấy câu hỏi
                  const hasGradeChartOnly = $reportPage("h3").filter((i, el) =>
                    $reportPage(el).text().includes("Overall number of students achieving grade ranges")
                  ).length > 0;

                  if (hasGradeChartOnly) {
                    console.log(`   ℹ️ Trang báo cáo chỉ hiển thị biểu đồ điểm, không có bài làm cá nhân. Bỏ qua.`);
                  } else {
                    // Điểm nằm trong thẻ <a> bên trong <td class="cell ... bold">
                    // ví dụ: <td class="cell c7 bold"><a href="...review.php?attempt=...">90,00</a></td>
                    $reportPage("td.bold a[href*='review.php?attempt=']").each((i, el) => {
                      const attemptHref = $reportPage(el).attr("href");
                      // Điểm hiển thị dạng "90,00" (locale tiếng Việt dùng dấu phẩy)
                      const gradeText = $reportPage(el).text().trim().replace(",", ".");
                      const grade = parseFloat(gradeText);
                      if (!isNaN(grade) && grade > 80) {
                        attemptLinks.push(attemptHref);
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
              if (isTestMode && uniqueAttempts.length > 0) {
                uniqueAttempts = [uniqueAttempts[0]];
              }
              if (uniqueAttempts.length === 0) {
                console.log(`   ℹ️ Không có lượt bài làm nào đạt >80 điểm. Bỏ qua bài trắc nghiệm này.`);
                quizCount++;
                continue;
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

                  for (let q = 0; q < questionBlocks.length; q++) {
                    const qBlock = questionBlocks[q];
                    const qtextEl = $review(qBlock).find(".qtext");
                    const qTextHtml = qtextEl.html() || "";

                    const { cleanHtml: qTextCleanHtml, uploadedUrls: qImgs } = await processHtmlImagesAndUpload(qTextHtml, getCookieHeader);
                    const $tempQ = cheerio.load(qTextCleanHtml);
                    const qTextClean = cleanQuestionText($tempQ, $tempQ("body"));

                    if (await isQuestionExists(qTextClean)) {
                      console.log(`      ⏭️ Câu hỏi [${q + 1}] đã tồn tại trong DB. Bỏ qua.`);
                      continue;
                    }

                    const choices = [];
                    const choiceImgsList = [];
                    const choiceBlocks = $review(qBlock).find(".answer div[class*='r0'], .answer div[class*='r1']");
                    for (let c = 0; c < choiceBlocks.length; c++) {
                      const imgTags = $review(choiceBlocks[c]).find("img");
                      for (let i = 0; i < imgTags.length; i++) {
                        const src = $review(imgTags[i]).attr("src");
                        if (src && !src.includes("grade_")) {
                          try {
                            const publicUrl = await uploadFileToStorage(src, "images", getCookieHeader);
                            choiceImgsList.push(publicUrl);
                          } catch (e) {}
                        }
                      }

                      const choiceHtml = $review(choiceBlocks[c]).html() || "";
                      const { cleanHtml: choiceClean } = await processHtmlImagesAndUpload(choiceHtml, getCookieHeader);
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
                            const publicUrl = await uploadFileToStorage(src, "images", getCookieHeader);
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
