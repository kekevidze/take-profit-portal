import { useEffect, useRef, useState, type ReactNode } from "react";
import superfundImg from "./imports/superfund.jpeg";
import singleMotherImg from "./imports/single_mother.jpg";
import gaveUponImg from "./imports/Gaveupon.jfif";
import mortgageImg from "./imports/mortgage.jpg";
import truckDriverImg from "./imports/truck_driver.jpg";
import pensionerImg from "./imports/pensioner.jpg";
import briefingVideo from "./imports/GlobeMarket.mp4";
import { initOnboardingGuideTracking } from "../onboarding-track.js";

const TESTIMONIALS = [
  {
    img: superfundImg,
    name: "Michael McCann",
    descriptor: "Superfund",
    quote:
      "I was worried my superfund wasn’t going to be enough for the future. This system helped me understand my options and gave me a clearer direction.",
  },
  {
    img: singleMotherImg,
    name: "Caterina Ferraro",
    descriptor: "Single Mother",
    quote:
      "As a single mother, I wanted to create more financial security for my family. My Account manager gave me guidance that was simple and easy to understand.",
  },
  {
    img: gaveUponImg,
    name: "Robert Broinowski",
    descriptor: "Investing",
    quote:
      "I had almost given up on investing. My portfolio wasn’t going anywhere, and I felt completely stuck. Getting the right guidance changed my perspective.",
  },
  {
    img: mortgageImg,
    name: "Shey Bustamante & John Turnbull",
    descriptor: "Mortgage Repayments",
    quote:
      "We were constantly stressing about our mortgage repayments. After speaking with my expert, we finally had a clearer understanding of our options.",
  },
  {
    img: truckDriverImg,
    name: "Malcolm Page",
    descriptor: "Truck Driver",
    quote:
      "As a truck driver, I never had much time to think about investing or planning for the future. The AI System made the process simple and helped me understand where I stood.",
  },
  {
    img: pensionerImg,
    name: "Susan Cooper",
    descriptor: "Pensioner",
    quote:
      "After retiring, I realised my pension wasn’t enough to live the lifestyle I wanted. It helped me explore my options and feel more confident about the future.",
  },
];

/* ------------------------------------------------------------------ *
 * Dynamic CRM data (injected at generation time from the personalized
 * URL). Placeholders shown here for the visual prototype.
 * ------------------------------------------------------------------ */
const CRM = {
  client: { firstName: "Alexander" },
  verification: { code: "4194" },
  video: { url: "" }, // {{video_url}} — embedded when available
  timezone: "GMT+01:00 · Central European Time",
};

const HERO_IMG =
  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=2000&h=1300&fit=crop&auto=format";
const FINALE_IMG =
  "https://images.unsplash.com/photo-1762486979891-b31db208ce3e?w=2000&h=1300&fit=crop&auto=format";
const MANAGER_IMG =
  "https://images.unsplash.com/photo-1758519288355-fe5b6fcc9f39?w=1400&h=1700&fit=crop&auto=format";
const VIDEO_POSTER =
  "https://images.unsplash.com/photo-1770740738717-94905d923dfe?w=1800&h=1013&fit=crop&auto=format";

/* ------------------------------------------------------------------ *
 * Scroll reveal
 * ------------------------------------------------------------------ */
function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: any;
  key?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={`reveal ${seen ? "is-visible" : ""} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span className="tracking-briefing text-[0.7rem] sm:text-xs uppercase text-[color:var(--gold)] font-mono">
    {children}
  </span>
);

const GoldRule = () => (
  <span className="inline-block h-px w-14 bg-gradient-to-r from-[color:var(--gold)] to-transparent align-middle" />
);

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */
export default function App() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    void initOnboardingGuideTracking({
      progressBarEl: document.getElementById("onboarding-reading-progress"),
      endSentinelEl: document.getElementById("onboarding-end-sentinel"),
    });
  }, []);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="min-h-screen bg-navy text-ivory font-sans overflow-x-hidden">
      <div
        className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-white/10"
        role="progressbar"
        aria-label="Onboarding reading progress"
      >
        <div
          id="onboarding-reading-progress"
          className="h-full w-0 bg-[color:var(--gold)] transition-[width] duration-300"
        />
      </div>
      <Header scrolled={scrolled} />
      <Hero />
      <AccountManager />
      <HowVerificationWorks />
      <BeforeAppointment />
      <Testimonials />
      <Finale />
      <div id="onboarding-end-sentinel" className="h-px" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------ Header ---------------------------- */
function Header({ scrolled }: { scrolled: boolean }) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-700 ${
        scrolled
          ? "bg-navy-900/80 backdrop-blur-xl border-b border-white/5 py-3"
          : "py-5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-3" />
        <div className="hidden items-center gap-2 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)]" />
          <span className="tracking-briefing text-[0.65rem] uppercase text-silver/90 font-mono">
            Personal Onboarding Portal
          </span>
        </div>
      </div>
    </header>
  );
}

/* ------------------------- Section 01 · Hero --------------------- */
function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <div className="absolute inset-0 bg-navy-900">
        <img
          src={HERO_IMG}
          alt="A commercial aircraft cruising above a sea of clouds at golden sunrise"
          className="h-full w-full object-cover opacity-70"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/85 via-navy-900/45 to-navy-900" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-900/85 to-transparent" />

      <div className="relative mx-auto w-full max-w-7xl px-6 pt-32 pb-24 lg:px-10">
        <div className="max-w-3xl">
          <Reveal className="flex items-center gap-4">
            <GoldRule />
            <Eyebrow>Confidential</Eyebrow>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="mt-8 font-display text-5xl leading-[1.02] sm:text-7xl lg:text-8xl">
              <span className="block">Welcome aboard</span>
              <span className="block text-[color:var(--gold)]"></span>
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-8 max-w-xl text-lg font-medium text-ivory/95 sm:text-xl">
              Your personalized onboarding briefing.
            </p>
          </Reveal>

          <Reveal delay={340}>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-silver/90">
              Before your journey begins, take a moment to understand your
              Account Manager, your Personal Verification Code, and how to verify
              communications with our company.
            </p>
          </Reveal>

        </div>
      </div>

      <a
        href="#briefing"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-silver/90 transition-colors hover:text-ivory"
      >
        <span className="tracking-briefing text-[0.6rem] uppercase font-mono">
          Continue
        </span>
        <span className="animate-bounce text-lg">↓</span>
      </a>
    </section>
  );
}

const PlayGlyph = () => (
  <span className="grid h-6 w-6 place-items-center rounded-full bg-navy-900/15">
    <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
      <path d="M0 0l9 5-9 5z" />
    </svg>
  </span>
);

/* --------------------- Section 02 · Video ------------------------ */
function VideoSection() {
  const [playing, setPlaying] = useState(false);
  return (
    <section id="briefing" className="relative bg-navy py-28 lg:py-36">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal className="mb-12 text-center">
          <Eyebrow>Your Briefing</Eyebrow>
        </Reveal>

        <Reveal delay={120}>
          <div className="group relative aspect-video overflow-hidden rounded-2xl bg-navy-800 shadow-2xl shadow-black/50 ring-1 ring-white/10">
            {playing ? (
              <video
                src={briefingVideo}
                poster={VIDEO_POSTER}
                controls
                autoPlay
                playsInline
                className="h-full w-full bg-navy-900 object-cover"
              />
            ) : (
              <>
                <img
                  src={VIDEO_POSTER}
                  alt="Cinematic sunrise above the clouds — GlobeMarkets briefing"
                  className="h-full w-full object-cover transition-transform duration-[1.4s] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-transparent to-navy-900/20" />
                <button
                  onClick={() => setPlaying(true)}
                  className="absolute inset-0 grid place-items-center"
                  aria-label="Play your briefing"
                >
                  <span className="grid h-20 w-20 place-items-center rounded-full border border-[color:var(--gold)]/70 bg-navy-900/40 backdrop-blur-md transition-all duration-500 group-hover:scale-110 group-hover:bg-[color:var(--gold)] group-hover:text-navy-900 text-[color:var(--gold)]">
                    <svg width="18" height="20" viewBox="0 0 9 10" fill="currentColor">
                      <path d="M0 0l9 5-9 5z" />
                    </svg>
                  </span>
                </button>
                <div className="absolute bottom-5 left-6 flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)]" />
                  <span className="tracking-briefing text-[0.6rem] uppercase text-ivory/95 font-mono"></span>
                </div>
              </>
            )}
          </div>
        </Reveal>

        <Reveal delay={220} className="mx-auto mt-10 max-w-xl text-center">
          <h2 className="font-display text-3xl sm:text-4xl">
            Your&nbsp;&nbsp;GlobeMarkets briefing
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-silver/90">
            A short introduction to your onboarding process, account support and
            security verification.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------- Section 03 · Account Manager -------------- */
function AccountManager() {
  const cards = [
    { n: "01", t: "Fine-tuning", d: "Calibrating your AI system around your preferences and goals." },
    { n: "02", t: "Personalization", d: "Shaping your experience to the way you actually work." },
    { n: "03", t: "Guidance", d: "Answering questions and guiding you throughout onboarding." },
  ];
  return (
    <section className="relative bg-navy-900 py-28 lg:py-36">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-10">
        <Reveal className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-navy-800 ring-1 ring-white/10">
            <img
              src={MANAGER_IMG}
              alt="A professional advisor reviewing plans with a client"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-900/70 to-transparent" />
          </div>
          <div className="absolute -bottom-6 -right-4 hidden rounded-xl border border-white/10 bg-navy-800/90 px-6 py-4 backdrop-blur-md sm:block">
            <div className="tracking-briefing text-[0.6rem] uppercase text-[color:var(--gold)] font-mono">
              Assigned during onboarding
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col justify-center">
          <Reveal className="flex items-center gap-4">
            <GoldRule />
            <Eyebrow>Your GlobeMarket Support</Eyebrow>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="mt-6 font-display text-4xl leading-tight sm:text-5xl">
              Your Account Manager
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-ivory/95">
              As part of your onboarding, you&rsquo;ll be connected with an
              Account Manager who will help fine-tune your AI system around your
              preferences and goals.
            </p>
          </Reveal>
          <Reveal delay={280}>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-silver/90">
              They can help configure your experience, explain how the technology
              works, answer questions and provide guidance throughout your
              onboarding.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/5 sm:grid-cols-3">
            {cards.map((c, i) => (
              <Reveal
                key={c.n}
                delay={360 + i * 90}
                className="bg-navy-900 p-6 transition-colors duration-500 hover:bg-navy-800"
              >
                <div className="font-mono text-xs text-[color:var(--gold)]">
                  {c.n}
                </div>
                <div className="mt-4 font-display text-xl">{c.t}</div>
                <p className="mt-2 text-xs leading-relaxed text-silver/90">
                  {c.d}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Section 04 · Verification Code ---------------- */
function VerificationCode() {
  return (
    <section className="relative bg-ivory py-28 text-navy-900 lg:py-36">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
        <Reveal className="flex items-center justify-center gap-4">
          <LockIcon className="h-5 w-5 text-[color:var(--gold)]" />
          <span className="tracking-briefing text-[0.7rem] uppercase text-navy-700 font-mono">
            Your Personal Verification Code
          </span>
        </Reveal>

        <Reveal delay={120}>
          <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-navy-800">
            Your Personal Verification Code was provided to you during
            activation. Keep it private and store it somewhere secure.
          </p>
        </Reveal>

        <Reveal delay={220}>
          <div className="mx-auto mt-12 max-w-xl rounded-3xl border border-navy-900/10 bg-white p-10 shadow-[0_30px_80px_-40px_rgba(10,27,51,0.5)]">
            <div className="flex items-center justify-center gap-2 text-navy-700">
              <LockIcon className="h-4 w-4" />
              <span className="tracking-briefing text-[0.6rem] uppercase font-mono">
                Confidential
              </span>
            </div>
            <div
              className="mt-6 select-none font-mono text-7xl font-bold tracking-[0.3em] text-navy-900 sm:text-8xl"
              aria-label="Your verification code"
            >
              {CRM.verification.code}
            </div>
            <div className="mx-auto mt-8 h-px w-24 bg-gradient-to-r from-transparent via-[color:var(--gold)] to-transparent" />
            <div className="mt-6 tracking-briefing text-[0.65rem] uppercase text-navy-800 font-mono">
              Keep this code private
            </div>
          </div>
        </Reveal>

        <Reveal delay={320}>
          <div className="mx-auto mt-10 flex max-w-xl items-start gap-3 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/8 px-5 py-4 text-left">
            <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--gold)]" />
            <p className="text-xs leading-relaxed text-navy-800/80">
              Never give your Personal Verification Code to someone who calls you
              claiming to represent GlobeMarkets.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------- Section 05 · How Verification Works ------------ */
function HowVerificationWorks() {
  const steps = [
    { n: "01", t: "Receive a call", d: "Someone contacts you claiming to represent the company." },
    { n: "02", t: "Ask for your code", d: "Ask them: “What is my verification code?”" },
    { n: "03", t: "Compare", d: "Compare the code they provide with the code in your secure onboarding portal." },
    { n: "04", t: "If it doesn’t match", d: "End the conversation and contact us through an official channel." },
  ];
  const flow = ["Call", "Ask", "Compare", "Verify"];
  return (
    <section className="relative bg-navy py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="max-w-2xl">
          <div className="flex items-center gap-4">
            <GoldRule />
            <Eyebrow>Security</Eyebrow>
          </div>
          <h2 className="mt-6 font-display text-4xl leading-tight sm:text-5xl">
            A simple security check
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-2">
            {steps.map((s, i) => (
              <Reveal
                key={s.n}
                delay={i * 90}
                className="group bg-navy-900 p-8 transition-colors duration-500 hover:bg-navy-800"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-3xl text-[color:var(--gold)]">
                    {s.n}
                  </span>
                  <span className="tracking-wide text-base font-semibold uppercase text-ivory">
                    {s.t}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-silver/90">
                  {s.d}
                </p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={220} className="flex flex-col justify-center">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-navy-800 to-navy-900 p-8">
              <div className="tracking-briefing text-[0.6rem] uppercase text-silver/85 font-mono">
                The flow
              </div>
              <div className="mt-6 flex flex-col gap-1">
                {flow.map((f, i) => (
                  <div key={f}>
                    <div
                      className={`flex items-center gap-4 rounded-lg px-4 py-3 ${
                        i === flow.length - 1
                          ? "bg-[color:var(--gold)]/12 text-[color:var(--gold)]"
                          : "text-ivory/95"
                      }`}
                    >
                      <span className="font-mono text-xs text-silver/90">
                        0{i + 1}
                      </span>
                      <span className="font-display text-2xl">{f}</span>
                    </div>
                    {i < flow.length - 1 && (
                      <div className="py-1 pl-8 text-silver/90">↓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* --------------- Section 06 · Verification Example -------------- */
function VerificationExample() {
  const [state, setState] = useState<"success" | "failure">("success");
  const yourCode = CRM.verification.code;
  const caller = state === "success" ? yourCode : "7429";
  const success = state === "success";

  return (
    <section className="relative bg-navy-900 py-28 lg:py-36">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <Reveal className="text-center">
          <Eyebrow>Section 06 · Try It</Eyebrow>
          <h2 className="mt-6 font-display text-4xl sm:text-5xl">
            See how a verification check works
          </h2>
        </Reveal>

        <Reveal delay={140} className="mt-10 flex justify-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            {(["success", "failure"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setState(s)}
                className={`rounded-full px-6 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-300 ${
                  state === s
                    ? "bg-[color:var(--gold)] text-navy-900"
                    : "text-silver/90 hover:text-ivory"
                }`}
              >
                {s === "success" ? "Codes match" : "Codes differ"}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          <CodePanel label="Your code" value={yourCode} tone="gold" />
          <CodePanel
            label="Caller provides"
            value={caller}
            tone={success ? "gold" : "danger"}
          />
        </div>

        <Reveal delay={200}>
          <div
            key={state}
            className={`gm-pop mx-auto mt-10 flex max-w-xl items-center justify-center gap-4 rounded-2xl border px-8 py-6 text-center ${
              success
                ? "border-emerald-400/30 bg-emerald-400/8 text-emerald-200"
                : "border-rose-400/30 bg-rose-400/8 text-rose-200"
            }`}
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-full text-lg ${
                success
                  ? "bg-emerald-400/20 text-emerald-300"
                  : "bg-rose-400/20 text-rose-300"
              }`}
            >
              {success ? "✓" : "×"}
            </span>
            <div className="text-left">
              <div className="font-display text-xl">
                {success ? "Code matched" : "Code does not match"}
              </div>
              <div className="text-xs text-silver/90">
                {success
                  ? "Verification check complete."
                  : "End the conversation."}
              </div>
            </div>
          </div>
        </Reveal>

        <p className="mx-auto mt-8 max-w-md text-center text-[0.7rem] leading-relaxed text-silver/90">
          A matching code is a GlobeMarkets verification check — not absolute
          proof of identity. Placeholder values are shown for demonstration.
        </p>
      </div>
    </section>
  );
}

function CodePanel({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gold" | "danger";
}) {
  return (
    <Reveal className="rounded-2xl border border-white/10 bg-gradient-to-b from-navy-800 to-navy-900 p-8 text-center">
      <div className="tracking-briefing text-[0.6rem] uppercase text-silver/85 font-mono">
        {label}
      </div>
      <div
        className={`mt-6 select-none font-mono text-6xl font-bold tracking-[0.25em] transition-colors duration-500 sm:text-7xl ${
          tone === "gold" ? "text-[color:var(--gold)]" : "text-rose-300"
        }`}
      >
        {value}
      </div>
    </Reveal>
  );
}

/* ---------- Sections 07–09 · Scheduling + Confirmation ---------- */
type Slot = { time: string; available: boolean };
type Day = { key: string; label: string; date: string; slots: Slot[] };

const SCHEDULE: Day[] = [
  {
    key: "tue",
    label: "Tuesday",
    date: "August 25",
    slots: [
      { time: "10:00", available: true },
      { time: "11:30", available: true },
      { time: "13:00", available: false },
      { time: "14:00", available: true },
      { time: "16:30", available: true },
    ],
  },
  {
    key: "wed",
    label: "Wednesday",
    date: "August 26",
    slots: [
      { time: "09:30", available: true },
      { time: "11:00", available: false },
      { time: "13:00", available: true },
      { time: "15:30", available: true },
    ],
  },
];

function Scheduling() {
  const [timeOfDay, setTimeOfDay] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ day: Day; slot: Slot } | null>(
    null,
  );

  const showSlots = timeOfDay && day;

  if (selected) {
    return (
      <Confirmation
        day={selected.day}
        slot={selected.slot}
        onChange={() => setSelected(null)}
      />
    );
  }

  const periods = [
    { key: "morning", t: "Morning", h: "08:00 – 12:00" },
    { key: "afternoon", t: "Afternoon", h: "12:00 – 17:00" },
    { key: "evening", t: "Evening", h: "17:00 – 20:00" },
  ];
  const days = [
    { key: "tue", t: "Today", d: "Tue · Aug 25" },
    { key: "wed", t: "Tomorrow", d: "Wed · Aug 26" },
    { key: "pick", t: "Choose a date", d: "Open calendar" },
  ];

  return (
    <section id="schedule" className="relative bg-navy py-28 lg:py-36">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <Reveal className="text-center">
          <Eyebrow>Section 07 · Schedule</Eyebrow>
          <h2 className="mx-auto mt-6 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
            Let&rsquo;s find the right time for you
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-silver/90">
            Your Account Manager will be assigned as part of your onboarding.
            Choose a time that works best for you.
          </p>
        </Reveal>

        {/* Time of day */}
        <Reveal delay={120} className="mt-16">
          <div className="mb-5 tracking-briefing text-[0.62rem] uppercase text-silver/85 font-mono">
            What would be the best time for you?
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {periods.map((p) => (
              <SelectCard
                key={p.key}
                active={timeOfDay === p.key}
                onClick={() => setTimeOfDay(p.key)}
                title={p.t}
                sub={p.h}
              />
            ))}
          </div>
        </Reveal>

        {/* Day */}
        <Reveal delay={160} className="mt-12">
          <div className="mb-5 tracking-briefing text-[0.62rem] uppercase text-silver/85 font-mono">
            Choose your preferred day
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {days.map((d) => (
              <SelectCard
                key={d.key}
                active={day === d.key}
                onClick={() => setDay(d.key)}
                title={d.t}
                sub={d.d}
              />
            ))}
          </div>
        </Reveal>

        {/* Available slots */}
        <div
          className={`grid transition-all duration-700 ${
            showSlots ? "mt-16 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="mb-6 flex items-center gap-4">
              <GoldRule />
              <span className="tracking-briefing text-[0.62rem] uppercase text-[color:var(--gold)] font-mono">
                Available onboarding appointments
              </span>
            </div>
            <div className="space-y-8">
              {SCHEDULE.map((d) => (
                <div key={d.key}>
                  <div className="mb-4 flex items-baseline gap-3">
                    <span className="font-display text-2xl text-ivory">
                      {d.label}
                    </span>
                    <span className="text-sm text-silver/85">{d.date}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {d.slots.map((s) => (
                      <button
                        key={s.time}
                        disabled={!s.available}
                        onClick={() =>
                          s.available && setSelected({ day: d, slot: s })
                        }
                        className={`group flex items-center justify-between rounded-xl border px-5 py-4 text-left transition-all duration-300 ${
                          s.available
                            ? "border-white/10 bg-white/5 hover:border-[color:var(--gold)]/60 hover:bg-[color:var(--gold)]/8"
                            : "cursor-not-allowed border-white/5 bg-transparent opacity-40"
                        }`}
                      >
                        <div>
                          <div className="font-mono text-lg text-ivory">
                            {s.time}
                          </div>
                          <div
                            className={`text-[0.62rem] uppercase tracking-wide ${
                              s.available
                                ? "text-emerald-300/80"
                                : "text-silver/90"
                            }`}
                          >
                            {s.available ? "Available" : "Unavailable"}
                          </div>
                        </div>
                        {s.available && (
                          <span className="tracking-briefing text-[0.6rem] uppercase text-[color:var(--gold)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 font-mono">
                            Select →
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectCard({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  key?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-6 text-left transition-all duration-400 ${
        active
          ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 shadow-lg shadow-[color:var(--gold)]/10"
          : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-2xl text-ivory">{title}</span>
        <span
          className={`grid h-5 w-5 place-items-center rounded-full border transition-all ${
            active
              ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-navy-900"
              : "border-white/25"
          }`}
        >
          {active && <span className="text-[0.6rem]">✓</span>}
        </span>
      </div>
      <div className="mt-2 font-mono text-xs text-silver/90">{sub}</div>
    </button>
  );
}

function Confirmation({
  day,
  slot,
  onChange,
}: {
  day: Day;
  slot: Slot;
  onChange: () => void;
}) {
  useEffect(() => {
    document.getElementById("schedule")?.scrollIntoView({ behavior: "smooth" });
  }, []);
  const rows = [
    { l: "Date", v: `${day.label}, ${day.date}` },
    { l: "Time", v: slot.time },
    { l: "Time zone", v: CRM.timezone },
    { l: "Account Manager", v: "Assigned before your appointment" },
  ];
  return (
    <section id="schedule" className="relative bg-navy py-28 lg:py-36">
      <div className="mx-auto max-w-2xl px-6 text-center lg:px-10">
        <div className="gm-pop mx-auto grid h-20 w-20 place-items-center rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/12 text-3xl text-[color:var(--gold)]">
          ✓
        </div>
        <h2 className="mt-8 font-display text-4xl sm:text-5xl">
          You&rsquo;re all set, {CRM.client.firstName}.
        </h2>
        <p className="mt-4 text-sm text-silver/90">
          Your GlobeMarkets onboarding appointment has been reserved.
        </p>

        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-navy-800 to-navy-900 text-left">
          {rows.map((r, i) => (
            <div
              key={r.l}
              className={`flex items-center justify-between px-7 py-5 ${
                i < rows.length - 1 ? "border-b border-white/8" : ""
              }`}
            >
              <span className="tracking-briefing text-[0.6rem] uppercase text-silver/90 font-mono">
                {r.l}
              </span>
              <span className="text-right text-sm text-ivory">{r.v}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button className="rounded-full bg-[color:var(--gold)] px-7 py-3.5 text-sm font-semibold text-navy-900 transition-colors hover:bg-[color:var(--gold-soft)]">
            Add to calendar
          </button>
          <button className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-ivory transition-colors hover:border-white/40">
            View appointment
          </button>
        </div>
        <button
          onClick={onChange}
          className="mt-6 text-xs tracking-wide text-silver/85 underline-offset-4 transition-colors hover:text-ivory hover:underline"
        >
          Change time
        </button>
      </div>
    </section>
  );
}

/* --------------- Section 10 · Before Appointment --------------- */
function BeforeAppointment() {
  const items = [
    "Keep your Personal Verification Code private",
    "Make a note of any questions you have",
    "Be ready to discuss how you’d like your AI experience configured",
  ];
  return (
    <section className="relative bg-navy-900 py-28 lg:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <Reveal className="flex items-center gap-4">
          <GoldRule />
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 font-display text-4xl sm:text-5xl">
            Before your appointment
          </h2>
        </Reveal>
        <div className="mt-12 space-y-px overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {items.map((t, i) => (
            <Reveal
              key={t}
              delay={i * 90}
              className="flex items-center gap-5 bg-navy-900 px-7 py-6 transition-colors duration-500 hover:bg-navy-800"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--gold)]/50 text-sm text-[color:var(--gold)]">
                ✓
              </span>
              <span className="text-base text-ivory/95">{t}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------ Customer Testimonials --------------------- */
function Testimonials() {
  const [perView, setPerView] = useState(3);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      setPerView(w < 768 ? 1 : w < 1024 ? 2 : 3);
    };
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  const pages = Math.ceil(TESTIMONIALS.length / perView);
  const current = Math.min(page, pages - 1);

  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [pages, page]);

  const go = (dir: number) =>
    setPage((p) => (p + dir + pages) % pages);

  return (
    <section className="relative bg-navy-900 py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="max-w-2xl">
          <div className="flex items-center gap-4">
            <GoldRule />
            <Eyebrow>Client Stories</Eyebrow>
          </div>
          <h2 className="mt-6 font-display text-4xl leading-tight sm:text-5xl">
            Real People. Real Financial Journeys.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-silver/90">
            See how others have taken the next step toward their financial goals.
          </p>
        </Reveal>

        <Reveal delay={120} className="mt-14">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="shrink-0 px-3"
                  style={{ width: `${100 / perView}%` }}
                >
                  <figure className="flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-navy-800 to-navy-900 p-7 shadow-xl shadow-black/30 transition-colors duration-500 hover:border-[color:var(--gold)]/40">
                    <div className="flex items-center gap-4">
                      <img
                        src={t.img}
                        alt={t.name}
                        className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                      />
                      <figcaption>
                        <div className="font-display text-lg text-ivory">
                          {t.name}
                        </div>
                        <div className="mt-0.5 tracking-briefing text-[0.58rem] uppercase text-[color:var(--gold)] font-mono">
                          {t.descriptor}
                        </div>
                      </figcaption>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      className="mt-6 h-6 w-6 text-[color:var(--gold)]/50"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M10 7H6a3 3 0 0 0-3 3v7h7v-7H6a1 1 0 0 1 1-1h3V7zm11 0h-4a3 3 0 0 0-3 3v7h7v-7h-4a1 1 0 0 1 1-1h3V7z" />
                    </svg>
                    <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-silver/90">
                      {t.quote}
                    </blockquote>
                  </figure>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <div className="flex gap-2.5">
              {Array.from({ length: pages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-400 ${
                    i === current
                      ? "w-7 bg-[color:var(--gold)]"
                      : "w-2 bg-white/25 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-3">
              {[
                { d: -1, label: "Previous", g: "‹" },
                { d: 1, label: "Next", g: "›" },
              ].map((b) => (
                <button
                  key={b.label}
                  onClick={() => go(b.d)}
                  aria-label={b.label}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-lg text-ivory transition-all duration-300 hover:border-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-navy-900"
                >
                  {b.g}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------- Finale + Footer ------------------------- */
function Finale() {
  return (
    <section className="relative flex min-h-[85vh] items-center overflow-hidden">
      <div className="absolute inset-0 bg-navy-900">
        <img
          src={FINALE_IMG}
          alt="An aircraft wing rising above the clouds in golden light"
          className="h-full w-full object-cover opacity-70"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/50 to-navy-900/70" />
      <div className="relative mx-auto w-full max-w-4xl px-6 text-center lg:px-10">
        <Reveal>
          <h2 className="font-display text-5xl leading-[1.05] sm:text-7xl">
            Your journey
            <span className="block text-[color:var(--gold)]">starts here.</span>
          </h2>
        </Reveal>
        <Reveal delay={140}>
          <p className="mx-auto mt-8 max-w-lg text-base font-medium text-ivory/95">
            Professional guidance. Personalized technology. Security designed
            around you.
          </p>
        </Reveal>
        <Reveal delay={240} className="mt-12 flex flex-col items-center gap-5">
          <div className="flex items-center gap-3 text-silver/90">
            {["Security", "Trust", "Guidance"].map((w, i) => (
              <span key={w} className="flex items-center gap-3">
                {i > 0 && (
                  <span className="h-1 w-1 rounded-full bg-[color:var(--gold)]" />
                )}
                <span className="tracking-briefing text-[0.6rem] uppercase font-mono">
                  {w}
                </span>
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------ Icons -------------------------- */
function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="15" r="1.3" fill="currentColor" />
    </svg>
  );
}
function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
