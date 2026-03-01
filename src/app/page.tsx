"use client";

import dynamic from "next/dynamic";
import SmoothScroll from "@/components/SmoothScroll";
import StaggeredMenu from "@/components/StaggeredMenu/StaggeredMenu";
import LoadingScreen from "@/components/LoadingScreen";
import ScrollFloat from "@/components/ScrollFloat";
import SectionDivider from "@/components/SectionDivider";
import About from "@/components/About/About";
import FeaturedWork from "@/components/FeaturedWork/FeaturedWork";
import AgentGraph from "@/components/AgentGraph/AgentGraph";
import Footer from "@/components/Footer/Footer";
// Dynamic import for Hero (has WebGL / Three.js content)
const Hero = dynamic(() => import("@/components/Hero/Hero"), {
  ssr: false,
});

const menuItems = [
  { label: "Home", ariaLabel: "Go to home section", link: "#hero" },
  { label: "About", ariaLabel: "Learn about the swarm", link: "#about" },
  { label: "Closed Loop", ariaLabel: "View the closed loop pipeline", link: "#work" },
  { label: "Architecture", ariaLabel: "View agent architecture", link: "#architecture" },
  { label: "Contact", ariaLabel: "Get in touch", link: "#footer" },
];

const socialItems = [
  { label: "Twitter/X", link: "https://x.com/home" },
  { label: "GitHub", link: "https://github.com/devrot-ai" },
  { label: "Discord", link: "https://discord.com/channels/1476833548551065672/1476833549276418110" },
];

export default function Home() {
  return (
    <>
      <LoadingScreen />
      <StaggeredMenu
        position="right"
        items={menuItems}
        socialItems={socialItems}
        displaySocials
        displayItemNumbering
        colors={["#0a0a1a", "#111128"]}
        accentColor="#00f0ff"
        menuButtonColor="#e8e6e3"
        openMenuButtonColor="#e8e6e3"
        changeMenuColorOnOpen
      />
      <SmoothScroll>
        <main>
          <Hero />

          <SectionDivider variant="glow" />

          <ScrollFloat
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.03}
          >
            Propose · Execute · React · Repeat
          </ScrollFloat>
          <About />

          <SectionDivider variant="dots" />

          <ScrollFloat
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.03}
          >
            How the Swarm Works
          </ScrollFloat>
          <FeaturedWork />

          <SectionDivider variant="gradient" />

          <ScrollFloat
            animationDuration={1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=50%"
            scrollEnd="bottom bottom-=40%"
            stagger={0.03}
          >
            The Agent Network
          </ScrollFloat>
          <AgentGraph />
        </main>

        <SectionDivider variant="glow" />

        <ScrollFloat
          animationDuration={0.8}
          ease="back.inOut(2)"
          scrollStart="center bottom+=50%"
          scrollEnd="bottom bottom-=40%"
          stagger={0.02}
        >
          Built for the Future
        </ScrollFloat>
        <Footer />
      </SmoothScroll>
    </>
  );
}
