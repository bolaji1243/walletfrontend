document.addEventListener("DOMContentLoaded", () => {
  const eyeOpenIcon = `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M12 5c5.523 0 9.685 4.52 10.75 6-.427.592-1.361 1.748-2.75 2.89l-1.273-1.273A11.33 11.33 0 0 0 20.56 11C19.216 9.55 15.933 7 12 7a8.9 8.9 0 0 0-3.477.702L6.95 6.13A10.85 10.85 0 0 1 12 5Zm-9.707.293 16.414 16.414-1.414 1.414-2.239-2.239A10.72 10.72 0 0 1 12 19c-5.523 0-9.685-4.52-10.75-6 .747-1.034 2.104-2.664 4.015-4.008L.879 6.707l1.414-1.414ZM6.7 10.427C5.171 11.504 4.09 12.72 3.44 13.5 4.784 14.95 8.067 17 12 17c.983 0 1.925-.128 2.808-.367l-1.924-1.924a4 4 0 0 1-5.517-5.517L6.7 10.427ZM12 9a2.99 2.99 0 0 1 2.97 3.346l-3.316-3.316c.114-.02.229-.03.346-.03Z"/>
    </svg>`;
  const eyeClosedIcon = `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M2 4.27 3.28 3 21 20.72 19.73 22l-2.358-2.358A11.39 11.39 0 0 1 12 21c-5.523 0-9.685-4.52-10.75-6 1.06-1.476 5.192-5.965 10.658-5.999L8.53 5.623A10.82 10.82 0 0 0 12 5c5.523 0 9.685 4.52 10.75 6-.64.89-1.834 2.343-3.604 3.621L16.9 12.375A11.3 11.3 0 0 0 20.56 11C19.216 9.55 15.933 7 12 7c-.855 0-1.682.12-2.465.345L7.8 5.61A8.91 8.91 0 0 1 12 5c-1.725 0-3.35.44-4.77 1.215L2 4.27Zm9.996 7.996 1.738 1.738A2 2 0 0 0 12 10c-.249 0-.488.045-.707.127l1.703 1.703ZM8.157 11.157 9.6 12.6a2.5 2.5 0 0 0 2.8 2.8l1.443 1.443A4.5 4.5 0 0 1 7.157 10.157l1 1Z"/>
    </svg>`;

  const slides = Array.from(document.querySelectorAll(".slide"));
  const dots = Array.from(document.querySelectorAll(".dot"));
  const loginForm = document.getElementById("loginForm");
  const emailOrPhoneInput = document.getElementById("emailOrPhone");
  const passwordInput = document.getElementById("password");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const rememberMeCheckbox = document.getElementById("rememberMe");
  const formMessage = document.getElementById("formMessage");
  const submitBtn = loginForm?.querySelector('button[type="submit"]');
  const phone = document.querySelector(".phone");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!loginForm || !emailOrPhoneInput || !passwordInput || !rememberMeCheckbox || !formMessage || !submitBtn) {
    return;
  }

  let currentSlide = 0;
  let slideTimer = null;

  function showSlide(index) {
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === index);
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
      dot.setAttribute("aria-pressed", String(dotIndex === index));
    });
  }

  function scheduleNextSlide() {
    if (prefersReducedMotion || slides.length < 2) {
      return;
    }

    clearTimeout(slideTimer);
    slideTimer = window.setTimeout(() => {
      currentSlide = (currentSlide + 1) % slides.length;
      showSlide(currentSlide);
      scheduleNextSlide();
    }, 4000);
  }

  if (slides.length) {
    showSlide(currentSlide);
    scheduleNextSlide();
  }

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      currentSlide = index;
      showSlide(currentSlide);
      scheduleNextSlide();
    });
  });

  togglePasswordBtn?.addEventListener("click", () => {
    const nextType = passwordInput.type === "password" ? "text" : "password";
    const eyeIcon = togglePasswordBtn.querySelector(".eye-icon");

    passwordInput.type = nextType;
    togglePasswordBtn.setAttribute("aria-label", nextType === "password" ? "Show password" : "Hide password");

    if (eyeIcon) {
      eyeIcon.innerHTML = nextType === "password" ? eyeOpenIcon : eyeClosedIcon;
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const emailOrPhone = emailOrPhoneInput.value.trim();
    const password = passwordInput.value.trim();
    const rememberMe = rememberMeCheckbox.checked;

    if (!emailOrPhone || !password) {
      showMessage("Please fill in your email or phone number and password.", "error");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.", "error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        window.FastPay?.buildUrl?.("/api/auth/login") || "http://localhost:8080/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailOrPhone, password })
        }
      );

      const parsed = window.FastPay?.readResponse
        ? await window.FastPay.readResponse(response)
        : { ok: response.ok, status: response.status, data: await response.json(), text: "" };
      const result = parsed.data || {};
      const authData = result.data || {};
      const token = authData.token || result.token;
      const userId = authData.userId || result.userId;

      if (!parsed.ok || !result.success || !token || !userId) {
        showMessage(
          window.FastPay?.extractMessage?.(parsed, "Invalid login credentials.") ||
          result.message ||
          "Invalid login credentials.",
          "error"
        );
        return;
      }

      localStorage.setItem("fastpay_token", token);
      localStorage.setItem("fastpay_userId", userId);

      if (rememberMe) {
        localStorage.setItem("fastpay_remember", "true");
        localStorage.setItem("fastpay_email", emailOrPhone);
      } else {
        localStorage.removeItem("fastpay_remember");
        localStorage.removeItem("fastpay_email");
      }

      showMessage("Login successful. Redirecting to your dashboard...", "success");
      window.setTimeout(() => {
        window.location.href = "../dashboard/dashboard.html";
      }, 1000);
    } catch (error) {
      console.error("Login error:", error);
      showMessage(
        navigator.onLine
          ? "We could not reach the server. Please try again."
          : "You appear to be offline. Check your connection and try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  });

  if (localStorage.getItem("fastpay_remember") === "true") {
    const rememberedValue = localStorage.getItem("fastpay_email");

    if (rememberedValue) {
      emailOrPhoneInput.value = rememberedValue;
      rememberMeCheckbox.checked = true;
    }
  }

  emailOrPhoneInput.addEventListener("blur", () => {
    const value = emailOrPhoneInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s\-()]{7,}$/;

    if (!value) {
      emailOrPhoneInput.style.borderColor = "";
      emailOrPhoneInput.style.boxShadow = "";
      return;
    }

    const valid = emailRegex.test(value) || phoneRegex.test(value);
    emailOrPhoneInput.style.borderColor = valid ? "rgba(34, 197, 94, 0.8)" : "rgba(248, 113, 113, 0.9)";
    emailOrPhoneInput.style.boxShadow = valid
      ? "0 0 0 4px rgba(34, 197, 94, 0.14)"
      : "0 0 0 4px rgba(248, 113, 113, 0.14)";
  });

  emailOrPhoneInput.addEventListener("input", () => {
    emailOrPhoneInput.style.borderColor = "";
    emailOrPhoneInput.style.boxShadow = "";
  });

  if (phone && !prefersReducedMotion) {
    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;

    document.addEventListener("mousemove", (event) => {
      mouseX = (event.clientX / window.innerWidth - 0.5) * 10;
      mouseY = (event.clientY / window.innerHeight - 0.5) * 10;
    });

    const animatePhone = () => {
      currentX += (mouseX - currentX) * 0.08;
      currentY += (mouseY - currentY) * 0.08;
      phone.style.transform = `translate(${currentX}px, ${currentY}px)`;
      window.requestAnimationFrame(animatePhone);
    };

    window.requestAnimationFrame(animatePhone);
  }

  function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type} show`;
  }

  function clearMessage() {
    formMessage.textContent = "";
    formMessage.className = "form-message";
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("loading", isLoading);
  }
});
