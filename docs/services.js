// Mobile menu toggle (services.html)
document.addEventListener("DOMContentLoaded", () => {
  const mobileMenu = document.getElementById("mobileMenu");
  const navLinks = document.getElementById("navLinks");
  const overlay = document.getElementById("overlay");

  if (!mobileMenu || !navLinks || !overlay) return;

  const icon = mobileMenu.querySelector("i");

  const openMenu = () => {
    navLinks.classList.add("active");
    overlay.classList.add("active");
    if (icon) {
      icon.classList.remove("fa-bars");
      icon.classList.add("fa-xmark");
    }
    document.body.style.overflow = "hidden"; // prevent background scroll
  };

  const closeMenu = () => {
    navLinks.classList.remove("active");
    overlay.classList.remove("active");
    if (icon) {
      icon.classList.remove("fa-xmark");
      icon.classList.add("fa-bars");
    }
    document.body.style.overflow = ""; // restore scroll
  };

  mobileMenu.addEventListener("click", () => {
    navLinks.classList.contains("active") ? closeMenu() : openMenu();
  });

  overlay.addEventListener("click", closeMenu);

  // Close menu when a link is clicked (mobile UX)
  navLinks.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", closeMenu);
  });

  // Optional: close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  new Swiper(".whySwiper", {
  loop: true,
  spaceBetween: 24,
  autoplay: {
    delay: 3500,
    disableOnInteraction: false,
  },
  pagination: {
    el: ".swiper-pagination",
    clickable: true,
  },
  breakpoints: {
    0: {
      slidesPerView: 1,
    },
    768: {
      slidesPerView: 2,
    },
    1200: {
      slidesPerView: 3,
    },
  },
});


});
