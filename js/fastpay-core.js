(function () {
  const DEFAULT_API_BASE = "http://localhost:8080";

  function getApiBase() {
    const saved = window.localStorage?.getItem("fastpay_api_base");
    return (saved && saved.trim()) || DEFAULT_API_BASE;
  }

  function getLoginPath() {
    const path = window.location.pathname.replace(/\\/g, "/");

    if (path.includes("/dashboard/")) return "../signup/login.html";
    if (path.includes("/signup/")) return "login.html";
    return "signup/login.html";
  }

  function getToken() {
    return window.localStorage?.getItem("fastpay_token") || "";
  }

  function getUserId() {
    return window.localStorage?.getItem("fastpay_userId") || "";
  }

  function clearSession() {
    window.localStorage?.removeItem("fastpay_token");
    window.localStorage?.removeItem("fastpay_userId");
  }

  function redirectToLogin(delayMs = 0) {
    const target = getLoginPath();

    if (delayMs > 0) {
      window.setTimeout(() => {
        window.location.href = target;
      }, delayMs);
      return;
    }

    window.location.href = target;
  }

  function applyTheme(theme) {
    const resolved = theme === "auto"
      ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.setAttribute("data-theme", resolved);
    if (resolved === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      document.body.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      document.body.classList.add("light");
    }
  }

  function initTheme() {
    const savedTheme = window.localStorage?.getItem("fastpay_theme") || "light";
    applyTheme(savedTheme);
  }

  function buildUrl(path) {
    if (!path) return getApiBase();
    if (/^https?:\/\//i.test(path)) return path;
    return `${getApiBase()}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  async function readResponse(response) {
    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      text,
      data,
      response,
    };
  }

  function extractMessage(result, fallback = "Request failed") {
    return (
      result?.data?.message ||
      result?.data?.error ||
      result?.data?.data?.message ||
      (result?.text && result.text.length < 220 ? result.text : "") ||
      fallback
    );
  }

  function authHeaders(extraHeaders) {
    const token = getToken();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    };
  }

  window.FastPay = {
    apiBase: getApiBase(),
    getApiBase,
    getLoginPath,
    getToken,
    getUserId,
    clearSession,
    redirectToLogin,
    buildUrl,
    readResponse,
    extractMessage,
    authHeaders,
    applyTheme,
    initTheme,
  };

  // Initialize theme on load
  initTheme();
})();
