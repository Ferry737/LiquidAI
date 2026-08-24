"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NAV_LINKS } from "@/lib/demo";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={false}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-400 ease-smooth ${
        scrolled
          ? "bg-carbon/80 backdrop-blur-xl border-b border-carbon-line"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="container-x flex items-center justify-between h-16 md:h-[72px]">
        <a href="#top" className="flex items-center gap-2.5 group">
          <Logo />
          <span className="font-semibold text-[17px] tracking-tight">LiquidAI</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-ivory/70 hover:text-ivory transition-colors duration-200"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:block">
          <a
            href="#launch"
            className="inline-flex items-center gap-2 rounded-pill bg-aqua px-5 py-2.5 text-sm font-semibold text-carbon hover:bg-aqua-glow transition-colors duration-200"
          >
            Launch App →
          </a>
        </div>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
          className="md:hidden flex flex-col gap-[5px] p-2"
        >
          <span className={`block h-[2px] w-6 bg-ivory transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`} />
          <span className={`block h-[2px] w-6 bg-ivory transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`block h-[2px] w-6 bg-ivory transition-transform ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden bg-carbon-soft border-b border-carbon-line"
          >
            <div className="container-x py-5 flex flex-col gap-4">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-ivory/80">
                  {l.label}
                </a>
              ))}
              <a href="#launch" onClick={() => setOpen(false)} className="rounded-pill bg-aqua px-5 py-3 text-center font-semibold text-carbon">
                Launch App →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function Logo() {
  return (
    <span className="relative inline-flex h-8 w-8 items-center justify-center">
      <svg viewBox="0 0 32 32" className="h-8 w-8">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3FE0C5" />
            <stop offset="1" stopColor="#4C8DFF" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="#111417" stroke="#222831" />
        <path d="M5 20 C 10 20, 10 12, 16 12 S 22 20, 27 20" fill="none" stroke="url(#lg)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="12" r="2.6" fill="#3FE0C5" />
      </svg>
    </span>
  );
}
