document.addEventListener("DOMContentLoaded", () => {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const registerForm = document.getElementById("registerForm");
  const formMessage = document.getElementById("formMessage");
  const fieldIds = ["firstName", "middleName", "lastName", "email", "phone", "password", "pin"];

  let currentSlide = 0;
  let slideTimer = null;
  let balanceAnimated = false;

  const slideDurations = [8000, 5000, 5000];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^(\+234|0)[789]\d{9}$/;
  const pinRegex = /^\d{4}$/;

  function showSlide(index) {
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === index);
    });

    if (!balanceAnimated && index === 0) {
      const amountElement = slides[index]?.querySelector(".balance-amount[data-count]");
      if (amountElement) {
        animateBalance(amountElement);
        balanceAnimated = true;
      }
    }
  }

  function animateBalance(amountElement) {
    const target = parseInt(amountElement.dataset.count || "100000", 10);
    const duration = 1600;
    const startTime = performance.now();

    function update(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = Math.floor(progress * target);
      amountElement.textContent = `₦${value.toLocaleString()}`;

      if (progress < 1) {
        window.requestAnimationFrame(update);
      }
    }

    window.requestAnimationFrame(update);
  }

  function nextSlide() {
    if (slides.length < 2) {
      return;
    }

    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
    clearTimeout(slideTimer);
    slideTimer = window.setTimeout(nextSlide, slideDurations[currentSlide] || 5000);
  }

  if (slides.length) {
    showSlide(currentSlide);
    slideTimer = window.setTimeout(nextSlide, slideDurations[currentSlide]);
  }

  function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId}Error`);

    if (input) {
      input.classList.add("error-input");
    }

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = "block";
    }
  }

  function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId}Error`);

    input?.classList.remove("error-input");

    if (errorElement) {
      errorElement.textContent = "";
      errorElement.style.display = "none";
    }
  }

  function clearAllErrors() {
    fieldIds.forEach(clearFieldError);
    formMessage.textContent = "";
    formMessage.className = "form-message";
  }

  function showFormMessage(message, type = "error") {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`;
    formMessage.style.display = "block";
  }

  const blurRules = {
    firstName: (value) => (!value ? "First name is required." : null),
    lastName: (value) => (!value ? "Last name is required." : null),
    email: (value) => {
      if (!value) return "Email address is required.";
      if (!emailRegex.test(value)) return "Please enter a valid email address.";
      return null;
    },
    phone: (value) => {
      if (!value) return "Phone number is required.";
      if (!phoneRegex.test(value)) return "Enter a valid Nigerian number, for example 08012345678.";
      return null;
    },
    password: (value) => {
      if (!value) return "Password is required.";
      if (value.length < 6) return "Password must be at least 6 characters.";
      if (!/[A-Z]/.test(value)) return "Password needs at least one uppercase letter.";
      if (!/[0-9]/.test(value)) return "Password needs at least one number.";
      return null;
    },
    pin: (value) => {
      if (!value) return "PIN is required.";
      if (!pinRegex.test(value)) return "PIN must be exactly 4 digits.";
      return null;
    }
  };

  Object.entries(blurRules).forEach(([fieldId, validate]) => {
    const element = document.getElementById(fieldId);

    if (!element) {
      return;
    }

    element.addEventListener("blur", () => {
      const error = validate(element.value.trim());
      if (error) {
        showFieldError(fieldId, error);
      } else {
        clearFieldError(fieldId);
      }
    });

    element.addEventListener("input", () => clearFieldError(fieldId));
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAllErrors();

    const firstName = document.getElementById("firstName")?.value.trim() || "";
    const middleName = document.getElementById("middleName")?.value.trim() || null;
    const lastName = document.getElementById("lastName")?.value.trim() || "";
    const email = document.getElementById("email")?.value.trim() || "";
    const phone = document.getElementById("phone")?.value.trim() || "";
    const password = document.getElementById("password")?.value || "";
    const pin = document.getElementById("pin")?.value || "";

    let hasError = false;
    const submitChecks = {
      firstName: blurRules.firstName(firstName),
      lastName: blurRules.lastName(lastName),
      email: blurRules.email(email),
      phone: blurRules.phone(phone),
      password: blurRules.password(password),
      pin: blurRules.pin(pin)
    };

    Object.entries(submitChecks).forEach(([fieldId, error]) => {
      if (error) {
        showFieldError(fieldId, error);
        hasError = true;
      }
    });

    if (hasError) {
      showFormMessage("Please fix the highlighted fields before continuing.");
      return;
    }

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || "Sign Up";

    if (submitBtn) {
      submitBtn.textContent = "Creating account...";
      submitBtn.disabled = true;
    }

    try {
      const response = await fetch(
        window.FastPay?.buildUrl?.("/api/auth/register") || "http://localhost:8080/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, middleName, lastName, email, phone, password, pin })
        }
      );

      const parsed = window.FastPay?.readResponse
        ? await window.FastPay.readResponse(response)
        : { ok: response.ok, status: response.status, data: null, text: await response.text() };
      const result = parsed.data || {};

      if (parsed.ok) {
        showFormMessage(
          result.message || parsed.text || "Account created successfully. Redirecting to login...",
          "success"
        );
        window.setTimeout(() => {
          window.location.href = "login.html";
        }, 1800);
        return;
      }

      if (parsed.status === 409) {
        showFieldError("email", "An account with this email already exists.");
        showFormMessage("This email is already registered. Please log in instead.");
        return;
      }

      if (parsed.status === 400 && result.errors && typeof result.errors === "object") {
        Object.entries(result.errors).forEach(([field, message]) => {
          showFieldError(field, String(message));
        });
        showFormMessage("Please fix the highlighted fields before continuing.");
        return;
      }

      showFormMessage(
        window.FastPay?.extractMessage?.(parsed, "Registration failed. Please try again.") ||
        "Registration failed. Please try again."
      );
    } catch (error) {
      console.error("Registration error:", error);
      showFormMessage(
        navigator.onLine
          ? "Unable to connect to the server. Please try again."
          : "You appear to be offline. Please check your internet connection."
      );
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  });
});
