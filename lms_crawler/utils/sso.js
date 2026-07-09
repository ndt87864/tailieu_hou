const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const COOKIES_FILE = path.join(__dirname, "../cookies.txt");
let cookieJar = [];

// Load cookies from file if exists
if (fs.existsSync(COOKIES_FILE)) {
  try {
    const fileContent = fs.readFileSync(COOKIES_FILE, "utf-8").trim();
    if (fileContent) {
      cookieJar = JSON.parse(fileContent);
    }
  } catch (err) {
    // Ignore error
  }
}

function saveCookies() {
  try {
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookieJar, null, 2), "utf-8");
  } catch (err) {
    // Ignore error
  }
}

function getCookieHeader() {
  return cookieJar.join("; ");
}

function updateCookies(setCookieHeaders) {
  if (!setCookieHeaders) return;
  let changed = false;
  for (const cookie of setCookieHeaders) {
    const parts = cookie.split(';');
    const mainCookie = parts[0].trim();
    if (mainCookie) {
      const [name] = mainCookie.split('=');
      const filtered = cookieJar.filter(c => !c.startsWith(name + '='));
      if (filtered.length !== cookieJar.length || !cookieJar.includes(mainCookie)) {
        cookieJar = filtered;
        cookieJar.push(mainCookie);
        changed = true;
      }
    }
  }
  if (changed) {
    saveCookies();
  }
}

async function getHtmlWithSso(url) {
  return requestWithSso(url, "GET", null);
}

async function postHtmlWithSso(url, requestData) {
  return requestWithSso(url, "POST", requestData);
}

async function requestWithSso(url, method, requestData) {
  let currentUrl = url;
  let response;
  let redirectsCount = 0;

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

module.exports = {
  getCookieHeader,
  updateCookies,
  getHtmlWithSso,
  postHtmlWithSso
};
