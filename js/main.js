// ================= DOM READY =================
document.addEventListener("DOMContentLoaded", () => {
  initSlider();
  initParticles();
  initStats();
  initScrollAnimations();
  initPhoneInteraction();
  initActionButtons();
  initYear();

  // ================= SLIDER FUNCTIONALITY =================
  function initSlider() {
    const slides = document.querySelectorAll(".slide");
    const indicators = document.querySelectorAll(".indicator");
    let current = 0;
    let timer = null;
    let balanceAnimated = false;
    let isUserInteracting = false;

    const timings = [12000, 10000, 10000, 10000];

    function showSlide(index) {
      slides.forEach((slide, i) => {
        slide.classList.remove("active");
        slide.style.transition = "transform 0.8s ease, opacity 0.8s ease";
        if (i === index) {
          slide.classList.add("active");
          slide.style.transform = "translateX(0) scale(1)";
          slide.style.opacity = "1";
        } else {
          slide.style.transform =
            i < index
              ? "translateX(-100%) scale(0.85) rotateY(-20deg)"
              : "translateX(100%) scale(0.85) rotateY(20deg)";
          slide.style.opacity = "0.6";
        }
      });

      indicators.forEach((indicator, i) => {
        indicator.classList.toggle("active", i === index);
      });

      if (!balanceAnimated && index === 0) {
        setTimeout(() => animateBalance(slides[index]), 300);
        balanceAnimated = true;
      }

      if (index === 0) {
        setTimeout(() => animateStatsOnSlide(slides[index]), 400);
      }
    }

    function scheduleNext() {
      if (isUserInteracting || slides.length === 0) return;

      clearTimeout(timer);
      timer = setTimeout(() => {
        current = (current + 1) % slides.length;
        showSlide(current);
        scheduleNext();
      }, timings[current]);
    }

    function animateBalance(slide) {
      const amount = slide.querySelector(".balance-amount[data-count]");
      if (!amount) return;

      const target = parseInt(amount.dataset.count, 10);
      const duration = 2000;
      const startTime = performance.now();

      function update(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const value = Math.floor(easeOutQuart * target);

        amount.textContent = `\u20A6${value.toLocaleString()}`;

        if (progress < 1) requestAnimationFrame(update);
      }

      requestAnimationFrame(update);
    }

    function animateStatsOnSlide(slide) {
      const stats = slide.querySelectorAll(".wallet-card h3");
      stats.forEach((stat, index) => {
        setTimeout(() => {
          stat.style.animation = "scaleIn 0.6s ease-out forwards";
        }, index * 200);
      });
    }

    indicators.forEach((indicator, index) => {
      indicator.addEventListener("click", () => {
        isUserInteracting = true;
        clearTimeout(timer);
        current = index;
        showSlide(current);

        setTimeout(() => {
          isUserInteracting = false;
          scheduleNext();
        }, 12000);
      });
    });

    let touchStartX = 0;
    let touchEndX = 0;
    const phoneScreen = document.querySelector(".phone-screen");

    if (phoneScreen) {
      phoneScreen.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
        isUserInteracting = true;
        clearTimeout(timer);
      });

      phoneScreen.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
        setTimeout(() => {
          isUserInteracting = false;
          scheduleNext();
        }, 12000);
      });
    }

    function handleSwipe() {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > swipeThreshold) {
        current = diff > 0
          ? (current + 1) % slides.length
          : (current - 1 + slides.length) % slides.length;
        showSlide(current);
      }
    }

    if (slides.length > 0) {
      showSlide(current);
      scheduleNext();
    }
  }

  // ================= ANIMATED PARTICLES =================
  function initParticles() {
    const particlesContainer = document.querySelector(".particles");
    if (!particlesContainer) return;

    for (let i = 0; i < 20; i += 1) {
      const particle = document.createElement("div");
      particle.className = "particle";
      particle.style.cssText = `
        position: absolute;
        width: ${Math.random() * 6 + 2}px;
        height: ${Math.random() * 6 + 2}px;
        background: rgba(99, 102, 241, ${Math.random() * 0.3 + 0.1});
        border-radius: 50%;
        top: ${Math.random() * 100}%;
        left: ${Math.random() * 100}%;
        animation: particleFloat ${Math.random() * 20 + 15}s linear infinite;
        animation-delay: ${Math.random() * 5}s;
      `;
      particlesContainer.appendChild(particle);
    }

    const style = document.createElement("style");
    style.textContent = `
      @keyframes particleFloat {
        0% {
          transform: translate(0, 0) rotate(0deg);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translate(${Math.random() * 200 - 100}px, -100vh) rotate(360deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ================= STATS COUNTER =================
  function initStats() {
    const statValues = document.querySelectorAll(".stat-value[data-target]");

    const animateStat = (element) => {
      const target = parseInt(element.dataset.target, 10);
      const duration = 2000;
      const startTime = performance.now();

      function update(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const value = Math.floor(easeOutQuart * target);

        element.textContent = value.toLocaleString();

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          element.textContent = target.toLocaleString();
        }
      }

      requestAnimationFrame(update);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateStat(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    statValues.forEach((stat) => observer.observe(stat));
  }

  // ================= SCROLL ANIMATIONS =================
  function initScrollAnimations() {
    const animateOnScroll = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animation = "fadeInUp 0.8s ease-out forwards";
          animateOnScroll.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -100px 0px"
    });

    document.querySelectorAll(".feature-card").forEach((card, index) => {
      card.style.opacity = "0";
      card.style.animationDelay = `${index * 0.1}s`;
      animateOnScroll.observe(card);
    });

    document.querySelectorAll(".section-header").forEach((header) => {
      header.style.opacity = "0";
      animateOnScroll.observe(header);
    });
  }

  // ================= PHONE INTERACTION =================
  function initPhoneInteraction() {
    const phone = document.querySelector(".phone");
    const phoneScreen = document.querySelector(".phone-screen");

    if (!phone || !phoneScreen) return;

    let mouseX = 0;
    let mouseY = 0;
    let phoneX = 0;
    let phoneY = 0;

    document.addEventListener("mousemove", (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function animatePhone() {
      phoneX += (mouseX * 15 - phoneX) * 0.05;
      phoneY += (mouseY * 15 - phoneY) * 0.05;
      phone.style.transform = `translate(${phoneX}px, ${phoneY}px)`;
      requestAnimationFrame(animatePhone);
    }

    animatePhone();

    phoneScreen.addEventListener("click", function (e) {
      const ripple = document.createElement("div");
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(99, 102, 241, 0.3);
        width: 20px;
        height: 20px;
        top: ${y}px;
        left: ${x}px;
        transform: translate(-50%, -50%) scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
      `;

      this.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    });

    if (!document.getElementById("ripple-style")) {
      const style = document.createElement("style");
      style.id = "ripple-style";
      style.textContent = `
        @keyframes ripple {
          to {
            transform: translate(-50%, -50%) scale(15);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ================= ACTION BUTTONS =================
  function initActionButtons() {
    const actions = document.querySelectorAll(".action[data-action]");

    actions.forEach((action) => {
      action.addEventListener("click", function () {
        this.style.transform = "scale(0.9)";

        setTimeout(() => {
          this.style.transform = "";
        }, 150);

        const actionType = this.dataset.action;
        showNotification(actionType);
      });
    });
  }

  function showNotification(type) {
    const messages = {
      deposit: "Opening deposit page...",
      transfer: "Transfer feature coming soon!",
      withdraw: "Withdraw feature coming soon!",
      bills: "Bill payment coming soon!"
    };

    const notification = document.createElement("div");
    notification.textContent = messages[type] || "Action clicked!";
    notification.style.cssText = `
      position: fixed;
      top: 100px;
      right: 24px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
      z-index: 10000;
      animation: slideInRight 0.4s ease-out, fadeOut 0.4s ease-out 2.6s forwards;
      font-weight: 600;
      font-size: 14px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);

    if (!document.getElementById("notification-style")) {
      const style = document.createElement("style");
      style.id = "notification-style";
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeOut {
          to {
            opacity: 0;
            transform: translateX(400px);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ================= SMOOTH SCROLL =================
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href === "#") return;

      e.preventDefault();
      const target = document.querySelector(href);

      if (target) {
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    });
  });

  // ================= HEADER SCROLL EFFECT =================
  let lastScroll = 0;
  const header = document.querySelector("header");

  if (header) {
    window.addEventListener("scroll", () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll > 100) {
        header.style.background = "rgba(15, 23, 42, 0.95)";
        header.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.3)";
      } else {
        header.style.background = "rgba(15, 23, 42, 0.85)";
        header.style.boxShadow = "none";
      }

      if (currentScroll > lastScroll && currentScroll > 500) {
        header.style.transform = "translateY(-100%)";
      } else {
        header.style.transform = "translateY(0)";
      }

      lastScroll = currentScroll;
    });
  }

  // ================= YEAR UPDATER =================
  function initYear() {
    const yearElement = document.getElementById("year");
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear();
    }
  }

  // ================= BUTTON HOVER EFFECTS =================
  document.querySelectorAll(".btn-primary").forEach((btn) => {
    btn.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-3px) scale(1.02)";
    });

    btn.addEventListener("mouseleave", function () {
      this.style.transform = "";
    });
  });

  // ================= FEATURE CARD TILT =================
  document.querySelectorAll(".feature-card").forEach((card) => {
    card.addEventListener("mousemove", function (e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      this.style.transform = `
        translateY(-8px)
        perspective(1000px)
        rotateX(${rotateX}deg)
        rotateY(${rotateY}deg)
      `;
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "";
    });
  });

  // ================= LOADING ANIMATION =================
  window.addEventListener("load", () => {
    document.body.style.opacity = "0";

    setTimeout(() => {
      document.body.style.transition = "opacity 0.6s ease-out";
      document.body.style.opacity = "1";
    }, 100);
  });

  // ================= PERFORMANCE OPTIMIZATION =================
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (prefersReducedMotion.matches) {
    document.querySelectorAll("*").forEach((el) => {
      el.style.animation = "none";
      el.style.transition = "none";
    });
  }
});
