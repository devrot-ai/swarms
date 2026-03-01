"use client";

import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useTheme } from "../ThemeProvider";

/* ── Types ── */
interface MenuItem {
  label: string;
  ariaLabel?: string;
  link: string;
}

interface SocialItem {
  label: string;
  link: string;
}

interface StaggeredMenuProps {
  position?: "left" | "right";
  colors?: string[];
  items?: MenuItem[];
  socialItems?: SocialItem[];
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  className?: string;
  logoText?: string;
  logoIcon?: string;
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  changeMenuColorOnOpen?: boolean;
  isFixed?: boolean;
  accentColor?: string;
  closeOnClickAway?: boolean;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
  onItemClick?: (item: MenuItem) => void;
}

export default function StaggeredMenu({
  position = "right",
  colors = ["#0a0a1a", "#111128"],
  items = [],
  socialItems = [],
  displaySocials = true,
  displayItemNumbering = true,
  className,
  logoText = "SWARMS",
  logoIcon = "⬡",
  menuButtonColor = "#e8e6e3",
  openMenuButtonColor = "#e8e6e3",
  changeMenuColorOnOpen = true,
  isFixed = false,
  accentColor = "#00f0ff",
  closeOnClickAway = true,
  onMenuOpen,
  onMenuClose,
  onItemClick,
}: StaggeredMenuProps) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  const panelRef = useRef<HTMLElement>(null);
  const preLayersRef = useRef<HTMLDivElement>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);

  const plusHRef = useRef<HTMLSpanElement>(null);
  const plusVRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const textInnerRef = useRef<HTMLSpanElement>(null);
  const textWrapRef = useRef<HTMLSpanElement>(null);
  const [textLines, setTextLines] = useState(["Menu", "Close"]);

  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const spinTweenRef = useRef<gsap.core.Timeline | null>(null);
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null);
  const colorTweenRef = useRef<gsap.core.Tween | null>(null);

  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);

  const itemEntranceTweenRef = useRef<gsap.core.Tween | null>(null);

  /* ── initial GSAP setup ── */
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;
      const plusH = plusHRef.current;
      const plusV = plusVRef.current;
      const icon = iconRef.current;
      const textInner = textInnerRef.current;

      if (!panel || !plusH || !plusV || !icon || !textInner) return;

      let preLayers: HTMLElement[] = [];
      if (preContainer) {
        preLayers = Array.from(
          preContainer.querySelectorAll<HTMLElement>(".sm-prelayer")
        );
      }
      preLayerElsRef.current = preLayers;

      const offscreen = position === "left" ? -100 : 100;
      gsap.set([panel, ...preLayers], { xPercent: offscreen });

      gsap.set(plusH, { transformOrigin: "50% 50%", rotate: 0 });
      gsap.set(plusV, { transformOrigin: "50% 50%", rotate: 90 });
      gsap.set(icon, { rotate: 0, transformOrigin: "50% 50%" });
      gsap.set(textInner, { yPercent: 0 });

      if (toggleBtnRef.current)
        gsap.set(toggleBtnRef.current, { color: menuButtonColor });
    });
    return () => ctx.revert();
  }, [menuButtonColor, position]);

  /* ── build the open timeline ── */
  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    if (closeTweenRef.current) {
      closeTweenRef.current.kill();
      closeTweenRef.current = null;
    }
    itemEntranceTweenRef.current?.kill();

    const itemEls = Array.from(
      panel.querySelectorAll<HTMLElement>(".sm-panel-itemLabel")
    );
    const numberEls = Array.from(
      panel.querySelectorAll<HTMLElement>(
        ".sm-panel-list[data-numbering] .sm-panel-item"
      )
    );
    const socialTitle = panel.querySelector<HTMLElement>(".sm-socials-title");
    const socialLinks = Array.from(
      panel.querySelectorAll<HTMLElement>(".sm-socials-link")
    );

    const layerStates = layers.map((el) => ({
      el,
      start: Number(gsap.getProperty(el, "xPercent")),
    }));
    const panelStart = Number(gsap.getProperty(panel, "xPercent"));

    if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    if (numberEls.length)
      gsap.set(numberEls, { "--sm-num-opacity": 0 } as gsap.TweenVars);
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    layerStates.forEach((ls, i) => {
      tl.fromTo(
        ls.el,
        { xPercent: ls.start },
        { xPercent: 0, duration: 0.5, ease: "power4.out" },
        i * 0.07
      );
    });

    const lastTime = layerStates.length
      ? (layerStates.length - 1) * 0.07
      : 0;
    const panelInsertTime = lastTime + (layerStates.length ? 0.08 : 0);
    const panelDuration = 0.65;

    tl.fromTo(
      panel,
      { xPercent: panelStart },
      { xPercent: 0, duration: panelDuration, ease: "power4.out" },
      panelInsertTime
    );

    if (itemEls.length) {
      const itemsStartRatio = 0.15;
      const itemsStart = panelInsertTime + panelDuration * itemsStartRatio;

      tl.to(
        itemEls,
        {
          yPercent: 0,
          rotate: 0,
          duration: 1,
          ease: "power4.out",
          stagger: { each: 0.1, from: "start" },
        },
        itemsStart
      );

      if (numberEls.length) {
        tl.to(
          numberEls,
          {
            duration: 0.6,
            ease: "power2.out",
            "--sm-num-opacity": 1,
            stagger: { each: 0.08, from: "start" },
          } as gsap.TweenVars,
          itemsStart + 0.1
        );
      }
    }

    if (socialTitle || socialLinks.length) {
      const socialsStart = panelInsertTime + panelDuration * 0.4;

      if (socialTitle)
        tl.to(
          socialTitle,
          { opacity: 1, duration: 0.5, ease: "power2.out" },
          socialsStart
        );
      if (socialLinks.length) {
        tl.to(
          socialLinks,
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            ease: "power3.out",
            stagger: { each: 0.08, from: "start" },
            onComplete: () => { gsap.set(socialLinks, { clearProps: "opacity" }); },
          },
          socialsStart + 0.04
        );
      }
    }

    openTlRef.current = tl;
    return tl;
  }, []);

  /* ── play open ── */
  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback("onComplete", () => {
        busyRef.current = false;
      });
      tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildOpenTimeline]);

  /* ── play close ── */
  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;
    itemEntranceTweenRef.current?.kill();

    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return;

    const all = [...layers, panel];
    closeTweenRef.current?.kill();

    const offscreen = position === "left" ? -100 : 100;

    closeTweenRef.current = gsap.to(all, {
      xPercent: offscreen,
      duration: 0.32,
      ease: "power3.in",
      overwrite: "auto",
      onComplete: () => {
        const itemEls = Array.from(
          panel.querySelectorAll<HTMLElement>(".sm-panel-itemLabel")
        );
        if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });

        const numberEls = Array.from(
          panel.querySelectorAll<HTMLElement>(
            ".sm-panel-list[data-numbering] .sm-panel-item"
          )
        );
        if (numberEls.length)
          gsap.set(numberEls, { "--sm-num-opacity": 0 } as gsap.TweenVars);

        const sTitle = panel.querySelector<HTMLElement>(".sm-socials-title");
        const sLinks = Array.from(
          panel.querySelectorAll<HTMLElement>(".sm-socials-link")
        );
        if (sTitle) gsap.set(sTitle, { opacity: 0 });
        if (sLinks.length) gsap.set(sLinks, { y: 25, opacity: 0 });

        busyRef.current = false;
      },
    });
  }, [position]);

  /* ── icon animation ── */
  const animateIcon = useCallback((opening: boolean) => {
    const icon = iconRef.current;
    const h = plusHRef.current;
    const v = plusVRef.current;
    if (!icon || !h || !v) return;

    spinTweenRef.current?.kill();

    if (opening) {
      gsap.set(icon, { rotate: 0, transformOrigin: "50% 50%" });
      spinTweenRef.current = gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .to(h, { rotate: 45, duration: 0.5 }, 0)
        .to(v, { rotate: -45, duration: 0.5 }, 0);
    } else {
      spinTweenRef.current = gsap
        .timeline({ defaults: { ease: "power3.inOut" } })
        .to(h, { rotate: 0, duration: 0.35 }, 0)
        .to(v, { rotate: 90, duration: 0.35 }, 0)
        .to(icon, { rotate: 0, duration: 0.001 }, 0);
    }
  }, []);

  /* ── button color animation ── */
  const animateColor = useCallback(
    (opening: boolean) => {
      const btn = toggleBtnRef.current;
      if (!btn) return;
      colorTweenRef.current?.kill();
      if (changeMenuColorOnOpen) {
        const targetColor = opening ? openMenuButtonColor : menuButtonColor;
        colorTweenRef.current = gsap.to(btn, {
          color: targetColor,
          delay: 0.18,
          duration: 0.3,
          ease: "power2.out",
        });
      } else {
        gsap.set(btn, { color: menuButtonColor });
      }
    },
    [openMenuButtonColor, menuButtonColor, changeMenuColorOnOpen]
  );

  React.useEffect(() => {
    if (toggleBtnRef.current) {
      if (changeMenuColorOnOpen) {
        const targetColor = openRef.current
          ? openMenuButtonColor
          : menuButtonColor;
        gsap.set(toggleBtnRef.current, { color: targetColor });
      } else {
        gsap.set(toggleBtnRef.current, { color: menuButtonColor });
      }
    }
  }, [changeMenuColorOnOpen, menuButtonColor, openMenuButtonColor]);

  /* ── text cycle animation ── */
  const animateText = useCallback((opening: boolean) => {
    const inner = textInnerRef.current;
    if (!inner) return;

    textCycleAnimRef.current?.kill();

    const currentLabel = opening ? "Menu" : "Close";
    const targetLabel = opening ? "Close" : "Menu";
    const cycles = 3;

    const seq = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < cycles; i++) {
      last = last === "Menu" ? "Close" : "Menu";
      seq.push(last);
    }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);

    setTextLines(seq);
    gsap.set(inner, { yPercent: 0 });

    const lineCount = seq.length;
    const finalShift = ((lineCount - 1) / lineCount) * 100;

    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -finalShift,
      duration: 0.5 + lineCount * 0.07,
      ease: "power4.out",
    });
  }, []);

  /* ── toggle ── */
  const toggleMenu = useCallback(() => {
    const target = !openRef.current;
    openRef.current = target;
    setOpen(target);

    if (target) {
      document.body.style.overflow = "hidden";
      onMenuOpen?.();
      playOpen();
    } else {
      document.body.style.overflow = "";
      onMenuClose?.();
      playClose();
    }

    animateIcon(target);
    animateColor(target);
    animateText(target);
  }, [
    playOpen,
    playClose,
    animateIcon,
    animateColor,
    animateText,
    onMenuOpen,
    onMenuClose,
  ]);

  /* ── close helper ── */
  const closeMenu = useCallback(() => {
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
      document.body.style.overflow = "";
      onMenuClose?.();
      playClose();
      animateIcon(false);
      animateColor(false);
      animateText(false);
    }
  }, [playClose, animateIcon, animateColor, animateText, onMenuClose]);

  /* ── click-away ── */
  React.useEffect(() => {
    if (!closeOnClickAway || !open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeOnClickAway, open, closeMenu]);

  /* ── handle item click — scroll to section & close ── */
  const handleItemClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, item: MenuItem) => {
      if (item.link.startsWith("#")) {
        e.preventDefault();
        closeMenu();
        // small delay so panel closes first
        setTimeout(() => {
          const el = document.querySelector(item.link);
          el?.scrollIntoView({ behavior: "smooth" });
        }, 350);
      }
      onItemClick?.(item);
    },
    [closeMenu, onItemClick]
  );

  /* ── Theme toggle sub-component ── */
  const ThemeToggleBtn = () => (
    <button
      className="sm-theme-toggle"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={toggleTheme}
      type="button"
    >
      {theme === "dark" ? (
        // Sun icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        // Moon icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );

  return (
    <div
      className={`sm-scope${isFixed ? " sm-fixed" : ""}`}
      style={{ zIndex: 1000 }}
    >
      <div
        className={
          (className ? className + " " : "") + "staggered-menu-wrapper"
        }
        style={
          accentColor
            ? ({ "--sm-accent": accentColor } as React.CSSProperties)
            : undefined
        }
        data-position={position}
        data-open={open || undefined}
      >
        {/* ── Pre-layers (color panels) ── */}
        <div
          ref={preLayersRef}
          className="sm-prelayers"
          aria-hidden="true"
        >
          {(() => {
            const raw =
              colors && colors.length
                ? colors.slice(0, 4)
                : ["#0a0a1a", "#111128"];
            const arr = [...raw];
            if (arr.length >= 3) {
              const mid = Math.floor(arr.length / 2);
              arr.splice(mid, 1);
            }
            return arr.map((c, i) => (
              <div
                key={i}
                className="sm-prelayer"
                style={{ background: c }}
              />
            ));
          })()}
        </div>

        {/* ── Header: logo + toggle ── */}
        <header
          className="staggered-menu-header"
          aria-label="Main navigation header"
        >
          <a href="#hero" className="sm-logo" onClick={() => closeMenu()}>
            <span className="sm-logo-icon">{logoIcon}</span>
            <span className="sm-logo-text">{logoText}</span>
          </a>

          <ThemeToggleBtn />

          <button
            ref={toggleBtnRef}
            className="sm-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="staggered-menu-panel"
            onClick={toggleMenu}
            type="button"
          >
            <span
              ref={textWrapRef}
              className="sm-toggle-textWrap"
              aria-hidden="true"
            >
              <span
                ref={textInnerRef}
                className="sm-toggle-textInner"
              >
                {textLines.map((l, i) => (
                  <span className="sm-toggle-line" key={i}>
                    {l}
                  </span>
                ))}
              </span>
            </span>

            <span
              ref={iconRef}
              className="sm-icon"
              aria-hidden="true"
            >
              <span ref={plusHRef} className="sm-icon-line" />
              <span ref={plusVRef} className="sm-icon-line sm-icon-line-v" />
            </span>
          </button>
        </header>

        {/* ── Panel ── */}
        <aside
          id="staggered-menu-panel"
          ref={panelRef}
          className="staggered-menu-panel"
          aria-hidden={!open}
        >
          <div className="sm-panel-inner">
            <ul
              className="sm-panel-list"
              role="list"
              data-numbering={displayItemNumbering || undefined}
            >
              {items.length ? (
                items.map((it, idx) => (
                  <li className="sm-panel-itemWrap" key={it.label + idx}>
                    <a
                      className="sm-panel-item"
                      href={it.link}
                      aria-label={it.ariaLabel}
                      data-index={idx + 1}
                      onClick={(e) => handleItemClick(e, it)}
                    >
                      <span className="sm-panel-itemLabel">
                        {it.label}
                      </span>
                    </a>
                  </li>
                ))
              ) : (
                <li className="sm-panel-itemWrap" aria-hidden="true">
                  <span className="sm-panel-item">
                    <span className="sm-panel-itemLabel">No items</span>
                  </span>
                </li>
              )}
            </ul>

            {displaySocials && socialItems.length > 0 && (
              <div className="sm-socials" aria-label="Social links">
                <h3 className="sm-socials-title">Socials</h3>
                <ul className="sm-socials-list" role="list">
                  {socialItems.map((s, i) => (
                    <li key={s.label + i} className="sm-socials-item">
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sm-socials-link"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      <style>{`
/* ── scope everything under .sm-scope ── */
.sm-scope { position: relative; z-index: 1000; pointer-events: none; }
.sm-scope.sm-fixed { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; }

.sm-scope .staggered-menu-wrapper {
  position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
  z-index: 1000; pointer-events: none;
}

/* ── header ── */
.sm-scope .staggered-menu-header {
  position: fixed; top: 0; left: 0; width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.5em 2em;
  background: transparent; pointer-events: none; z-index: 1020;
}
.sm-scope .staggered-menu-header > * { pointer-events: auto; }

/* ── logo ── */
.sm-scope .sm-logo {
  display: flex; align-items: center; gap: 0.5rem;
  text-decoration: none; user-select: none;
}
.sm-scope .sm-logo-icon {
  font-size: 1.6rem; color: var(--sm-accent, #00f0ff);
  line-height: 1;
}
.sm-scope .sm-logo-text {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.1rem; font-weight: 700;
  letter-spacing: 0.15em; color: var(--text-primary, #e8e6e3);
}

/* ── theme toggle ── */
.sm-scope .sm-theme-toggle {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
  border-radius: 50%; background: var(--glass-bg, rgba(17,17,24,0.5));
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  cursor: pointer; transition: all 0.3s ease;
  color: var(--text-primary, #e8e6e3);
  font-size: 1rem; line-height: 1;
}
.sm-scope .sm-theme-toggle:hover {
  border-color: var(--accent-cyan, #00f0ff);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.15);
  transform: rotate(15deg);
}

/* ── toggle button ── */
.sm-scope .sm-toggle {
  position: relative; display: inline-flex; align-items: center;
  gap: 0.5rem; background: transparent; border: none;
  cursor: pointer; color: var(--text-primary, #e8e6e3); font-family: 'Space Grotesk', sans-serif;
  font-size: 0.85rem; font-weight: 500; letter-spacing: 0.08em;
  text-transform: uppercase; line-height: 1; overflow: visible;
}
.sm-scope .sm-toggle:focus-visible {
  outline: 2px solid rgba(255,255,255,0.5); outline-offset: 4px; border-radius: 4px;
}

/* text wrap */
.sm-scope .sm-toggle-textWrap {
  position: relative; display: inline-block;
  height: 1em; overflow: hidden; white-space: nowrap;
  min-width: 3em;
}
.sm-scope .sm-toggle-textInner {
  display: flex; flex-direction: column; line-height: 1;
}
.sm-scope .sm-toggle-line { display: block; height: 1em; line-height: 1; }

/* icon (+/×) */
.sm-scope .sm-icon {
  position: relative; width: 14px; height: 14px;
  flex: 0 0 14px; display: inline-flex;
  align-items: center; justify-content: center; will-change: transform;
}
.sm-scope .sm-icon-line {
  position: absolute; left: 50%; top: 50%;
  width: 100%; height: 2px; background: currentColor;
  border-radius: 2px; transform: translate(-50%, -50%);
  will-change: transform;
}

/* ── pre-layers ── */
.sm-scope .sm-prelayers {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: clamp(280px, 42vw, 480px);
  pointer-events: none; z-index: 1005;
}
.sm-scope [data-position='left'] .sm-prelayers { right: auto; left: 0; }

.sm-scope .sm-prelayer {
  position: absolute; top: 0; right: 0;
  height: 100%; width: 100%;
}

/* ── panel ── */
.sm-scope .staggered-menu-panel {
  position: fixed; top: 0; right: 0;
  width: clamp(280px, 42vw, 480px); height: 100%;
  background: var(--bg-secondary, #111118);
  border-left: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
  display: flex; flex-direction: column;
  padding: 7em 2.5em 2.5em 2.5em;
  overflow-y: auto; z-index: 1010;
  pointer-events: auto;
}
.sm-scope [data-position='left'] .staggered-menu-panel {
  right: auto; left: 0;
  border-left: none; border-right: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
}

.sm-scope .sm-panel-inner {
  flex: 1; display: flex; flex-direction: column; gap: 1.5rem;
}

/* ── menu items ── */
.sm-scope .sm-panel-list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.25rem;
}

.sm-scope .sm-panel-itemWrap {
  position: relative; overflow: hidden; line-height: 1;
}

.sm-scope .sm-panel-item {
  position: relative; color: var(--text-primary, #e8e6e3);
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600; font-size: clamp(2rem, 5vw, 3.5rem);
  cursor: pointer; line-height: 1.15; letter-spacing: -1px;
  text-transform: uppercase;
  transition: color 0.25s ease;
  display: inline-block; text-decoration: none;
  padding-right: 1.4em;
}

.sm-scope .sm-panel-itemLabel {
  display: inline-block; will-change: transform;
  transform-origin: 50% 100%;
}

.sm-scope .sm-panel-item:hover { color: var(--sm-accent, #00f0ff); }

/* numbering */
.sm-scope .sm-panel-list[data-numbering] { counter-reset: smItem; }
.sm-scope .sm-panel-list[data-numbering] .sm-panel-item::after {
  counter-increment: smItem;
  content: counter(smItem, decimal-leading-zero);
  position: absolute; top: 0.15em; right: 0;
  font-size: 0.85rem; font-weight: 400;
  color: var(--sm-accent, #00f0ff);
  letter-spacing: 0; pointer-events: none; user-select: none;
  opacity: var(--sm-num-opacity, 0);
}

/* ── socials ── */
.sm-scope .sm-socials {
  margin-top: auto; padding-top: 2rem;
  display: flex; flex-direction: column; gap: 0.75rem;
  border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
}
.sm-scope .sm-socials-title {
  margin: 0; font-size: 0.75rem; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--sm-accent, #00f0ff);
  font-family: 'Space Grotesk', sans-serif;
}
.sm-scope .sm-socials-list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: row; align-items: center;
  gap: 1.25rem; flex-wrap: wrap;
}
.sm-scope .sm-socials-link {
  font-size: 0.95rem; font-weight: 500;
  color: var(--text-secondary, #9d9d9d); text-decoration: none;
  position: relative; padding: 2px 0;
  display: inline-block;
  transition: color 0.3s ease, opacity 0.3s ease;
  font-family: 'Inter', sans-serif;
}
.sm-scope .sm-socials-link:hover { color: var(--sm-accent, #00f0ff); }
.sm-scope .sm-socials-list:hover .sm-socials-link:not(:hover) { opacity: 0.35; }

/* ── responsive ── */
@media (max-width: 768px) {
  .sm-scope .staggered-menu-panel { width: 100%; }
  .sm-scope .sm-prelayers { width: 100%; }
  .sm-scope .sm-panel-item { font-size: clamp(1.8rem, 8vw, 3rem); }
}
      `}</style>
    </div>
  );
}
