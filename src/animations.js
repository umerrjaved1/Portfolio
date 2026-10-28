import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

// Physics-Based Magnetic Micro-Interactions ---------------------------------
export function initGsapMagnetic(root = document) {
  if (!finePointer || reducedMotion) return;

  root.querySelectorAll(".magnetic").forEach((node) => {
    if (node.dataset.magnetic) return;
    node.dataset.magnetic = "1";
    const inner = node.querySelector("span, svg, .btn-inner") || node;

    const onMove = (e) => {
      const rect = node.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) / (rect.width / 2);
      const deltaY = (e.clientY - centerY) / (rect.height / 2);

      const pullDistance = 14;
      gsap.to(node, {
        x: deltaX * pullDistance,
        y: deltaY * (pullDistance * 0.8),
        rotation: deltaX * 2,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
      });

      if (inner !== node) {
        gsap.to(inner, {
          x: deltaX * 7,
          y: deltaY * 5,
          duration: 0.35,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    };

    const onLeave = () => {
      gsap.to(node, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: 0.8,
        ease: "elastic.out(1.15, 0.35)",
        overwrite: "auto",
      });

      if (inner !== node) {
        gsap.to(inner, {
          x: 0,
          y: 0,
          duration: 0.8,
          ease: "elastic.out(1.15, 0.35)",
          overwrite: "auto",
        });
      }
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
  });
}

// Hero Section Entrance Timeline matching david-hckh.com ---------------------
export function playHeroEntrance() {
  if (reducedMotion) return;

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  tl.from(".topbar", {
    y: -24,
    opacity: 0,
    duration: 0.65,
    clearProps: "transform,opacity",
  })
  .from(".hero-name .letter", {
    y: 50,
    opacity: 0,
    stagger: 0.03,
    duration: 0.7,
    ease: "back.out(1.5)",
    clearProps: "transform,opacity",
  }, "-=0.35")
  .from(".hero-role .banner-bg", {
    scaleX: 0,
    duration: 0.5,
    ease: "power3.inOut",
    clearProps: "transform",
  }, "-=0.35")
  .from(".hero-role .appearing-text", {
    opacity: 0,
    duration: 0.35,
    clearProps: "opacity",
  }, "-=0.15")
  .from(".scroll-cue", {
    opacity: 0,
    duration: 0.5,
    clearProps: "opacity",
  }, "-=0.25");

  return tl;
}

// ScrollTrigger Staggered Reveals --------------------------------------------
export function initScrollReveals() {
  if (reducedMotion) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
    return;
  }

  gsap.set(".reveal", { opacity: 0, y: 32 });
  ScrollTrigger.batch(".reveal", {
    interval: 0.1,
    batchMax: 4,
    onEnter: (batch) => {
      gsap.fromTo(
        batch,
        { opacity: 0, y: 32 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.08,
          duration: 0.7,
          ease: "power3.out",
          overwrite: "auto",
          clearProps: "transform",
        }
      );
    },
    once: true,
  });
}
