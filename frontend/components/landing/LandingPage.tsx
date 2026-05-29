"use client";

import { useEffect } from "react";
import { Nav, Hero, Problem, Overview } from "./sections-hero";
import { HowItWorks, BrightData, Evidence } from "./sections-how";
import { ProductPreview, AlertChannels, McpServers } from "./sections-product";
import { AgentWork } from "./sections-agent";
import { Hackathon, FinalCta, Footer } from "./sections-close";

/* Scroll-reveal: arms anything already on screen immediately, observes the
   rest, and has a safety net so nothing can stay hidden. Ported from the
   design handoff (js/app.jsx useReveal). */
function useReveal() {
  useEffect(() => {
    const els = Array.prototype.slice.call(document.querySelectorAll(".reveal")) as HTMLElement[];
    const arm = () => {
      const vh = window.innerHeight || 800;
      els.forEach((e) => {
        if (e.classList.contains("in")) return;
        const r = e.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) e.classList.add("in");
      });
    };
    arm();
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              io?.unobserve(en.target);
            }
          });
        },
        { threshold: 0.06, rootMargin: "0px 0px -4% 0px" }
      );
      els.forEach((e) => io?.observe(e));
    }
    window.addEventListener("scroll", arm, { passive: true });
    window.addEventListener("resize", arm);
    const safety = setTimeout(() => els.forEach((e) => e.classList.add("in")), 6000);
    return () => {
      if (io) io.disconnect();
      window.removeEventListener("scroll", arm);
      window.removeEventListener("resize", arm);
      clearTimeout(safety);
    };
  }, []);
}

export function LandingPage() {
  useReveal();
  return (
    <div className="app app--grain">
      <Nav />
      <main>
        <Hero layout="split" />
        <Problem />
        <Overview />
        <HowItWorks />
        <BrightData />
        <Evidence />
        <ProductPreview />
        <AgentWork />
        <AlertChannels />
        <McpServers />
        <Hackathon />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
