import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FitText, fontFamily } from "./FitText";

export const C = {
  mint: "#3DDC97",
  mintSoft: "#E6FBF2",
  teal: "#0F766E",
  tealDark: "#0B4F4A",
  ink: "#12302D",
  white: "#FFFFFF",
  gold: "#F0BD5B",
  warm: "#FFF5E6",
};
export const SIZES = { portrait: { width: 1080, height: 1350 }, vertical: { width: 1080, height: 1920 } } as const;
export type Size = keyof typeof SIZES;

export type CardProps = { headline: string; body: string; size: Size; eyebrow?: string; logoUrl?: string; imageUrl?: string; brandName?: string; ctaText?: string };
export type SlideProps = { text: string; index: number; total: number; size: Size; cta?: boolean; logoUrl?: string; brandName?: string; ctaText?: string };
export type VideoProps = { headline: string; beats: string[]; recording?: string; eyebrow?: string; logoUrl?: string; soundtrackUrl?: string; brandName?: string; ctaText?: string };

export const BEAT_FRAMES = 135; // 4.5 s at 30 fps
export const END_FRAMES = 90;

const Brand: React.FC<{ light?: boolean; logoUrl?: string; brandName?: string }> = ({ light, logoUrl, brandName }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily, fontWeight: 800, fontSize: 40, color: light ? C.white : C.tealDark }}>
    <Img src={logoUrl ?? staticFile("logo.svg")} style={{ width: 84, height: 84, borderRadius: 20, objectFit: "contain" }} />
    {brandName || "Your brand"}
  </div>
);

const Footer: React.FC<{ light?: boolean; ctaText?: string }> = ({ light, ctaText }) => (
  <div style={{ fontFamily, fontWeight: 500, fontSize: 34, color: light ? C.mintSoft : C.teal }}>
    {ctaText || "Follow for the next useful idea"}
  </div>
);

const Chip: React.FC<{ children: string; dark?: boolean }> = ({ children, dark }) => (
  <div style={{ alignSelf: "flex-start", fontFamily, fontWeight: 800, fontSize: 30, letterSpacing: 3, padding: "10px 24px", borderRadius: 999, background: dark ? C.tealDark : C.mintSoft, color: dark ? C.mint : C.teal }}>
    {children}
  </div>
);

const pad = 80;

const Glow: React.FC = () => (
  <>
    <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 260, background: "rgba(255,255,255,.10)", right: -180, top: -160 }} />
    <div style={{ position: "absolute", width: 260, height: 260, borderRadius: 130, border: "34px solid rgba(255,255,255,.08)", left: -110, bottom: -80 }} />
  </>
);

/** Image 1: farm tip / install ask. Mint card on white. */
export const TipCard: React.FC<CardProps> = ({ headline, body, eyebrow, logoUrl, imageUrl, brandName, ctaText }) => (
  <AbsoluteFill style={{ background: C.white, padding: pad, display: "flex", flexDirection: "column", gap: 40 }}>
    <Brand logoUrl={logoUrl} brandName={brandName} />
    <div style={{ position: "relative", overflow: "hidden", flex: 1, minHeight: 0, background: `linear-gradient(155deg, ${C.mint}, ${C.tealDark})`, borderRadius: 52, padding: 64, display: "flex", flexDirection: "column", gap: 32, boxShadow: "0 28px 70px rgba(11,79,74,.18)" }}>
      {imageUrl && <Img src={imageUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.34 }} />}
      <Glow />
      <Chip dark>{eyebrow || "FARM TIP"}</Chip>
      <div style={{ flex: 3, minHeight: 0, zIndex: 1 }}><FitText text={headline} max={120} min={48} style={{ fontWeight: 800, color: C.white, letterSpacing: -3 }} /></div>
      <div style={{ flex: 2, minHeight: 0 }}><FitText text={body} max={52} min={26} style={{ fontWeight: 500, color: C.mintSoft, lineHeight: 1.3 }} /></div>
    </div>
    <Footer ctaText={ctaText} />
  </AbsoluteFill>
);

/** Image 2: calculator demo. Teal background, white panel with a big headline. */
export const StatCard: React.FC<CardProps> = ({ headline, body, eyebrow, logoUrl, brandName, ctaText }) => (
  <AbsoluteFill style={{ background: C.tealDark, padding: pad, display: "flex", flexDirection: "column", gap: 40 }}>
    <Brand light logoUrl={logoUrl} brandName={brandName} />
    <Chip>{eyebrow || "FARM CALCULATOR"}</Chip>
    <div style={{ flex: 1, minHeight: 0, background: C.warm, borderRadius: 52, padding: 64, display: "flex", flexDirection: "column", gap: 32, borderLeft: `24px solid ${C.gold}`, boxShadow: "0 28px 70px rgba(0,0,0,.15)" }}>
      <div style={{ flex: 3, minHeight: 0 }}><FitText text={headline} max={120} min={48} style={{ fontWeight: 800, color: C.tealDark, letterSpacing: -3 }} /></div>
      <div style={{ flex: 2, minHeight: 0 }}><FitText text={body} max={52} min={26} style={{ fontWeight: 500, color: C.ink, lineHeight: 1.3 }} /></div>
    </div>
    <Footer light ctaText={ctaText} />
  </AbsoluteFill>
);

/** Image 3: problem and fix. Two stacked panels. */
export const ProblemFixCard: React.FC<CardProps> = ({ headline, body, eyebrow, logoUrl, brandName, ctaText }) => (
  <AbsoluteFill style={{ background: C.mintSoft, padding: pad, display: "flex", flexDirection: "column", gap: 32 }}>
    <Brand logoUrl={logoUrl} brandName={brandName} />
    <div style={{ flex: 1, minHeight: 0, background: C.white, borderRadius: 40, padding: 56, display: "flex", flexDirection: "column", gap: 20 }}>
      <Chip>{eyebrow || "THE PROBLEM"}</Chip>
      <div style={{ flex: 1, minHeight: 0 }}><FitText text={headline} max={100} min={44} style={{ fontWeight: 800, color: C.ink }} /></div>
    </div>
    <div style={{ flex: 1, minHeight: 0, background: C.teal, borderRadius: 40, padding: 56, display: "flex", flexDirection: "column", gap: 20 }}>
      <Chip dark>THE FIX</Chip>
      <div style={{ flex: 1, minHeight: 0 }}><FitText text={body} max={60} min={26} style={{ fontWeight: 500, color: C.white, lineHeight: 1.3 }} /></div>
    </div>
    <Footer ctaText={ctaText} />
  </AbsoluteFill>
);

/** Carousel slide. The last slide (cta) is the install ask. */
export const CarouselSlide: React.FC<SlideProps> = ({ text, index, total, cta, logoUrl, brandName, ctaText }) => (
  <AbsoluteFill style={{ background: cta ? `linear-gradient(160deg, ${C.mint}, ${C.teal})` : C.white, padding: pad, display: "flex", flexDirection: "column", gap: 40 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Brand light={cta} logoUrl={logoUrl} brandName={brandName} />
      <div style={{ fontFamily, fontWeight: 800, fontSize: 36, color: cta ? C.white : C.teal }}>{index}/{total}</div>
    </div>
    <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center" }}>
      <div style={{ width: "100%", height: "100%" }}>
        <FitText text={text} max={110} min={40} style={{ fontWeight: 800, color: cta ? C.white : C.tealDark, display: "flex", alignItems: "center" }} />
      </div>
    </div>
    <div style={{ display: "flex", gap: 14 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ width: i + 1 === index ? 56 : 20, height: 20, borderRadius: 10, background: cta ? C.white : i + 1 === index ? C.teal : C.mintSoft }} />
      ))}
    </div>
    <Footer light={cta} ctaText={ctaText} />
  </AbsoluteFill>
);

/** 15–30 s vertical video: headline, 3–5 on-screen beats over a phone frame, end card. */
export const PromoVideo: React.FC<VideoProps> = ({ headline, beats, recording, eyebrow, logoUrl, soundtrackUrl, brandName, ctaText }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 40]);
  const endStart = durationInFrames - END_FRAMES;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${160 + drift}deg, ${C.mint}, ${C.tealDark})`, fontFamily }}>
      {soundtrackUrl && <Audio src={soundtrackUrl} volume={0.35} />}
      <AbsoluteFill style={{ padding: "110px 80px 0", display: "flex", flexDirection: "column", gap: 30 }}>
        <Brand light logoUrl={logoUrl} brandName={brandName} />
        <Chip dark>{eyebrow || "FARM SMARTER"}</Chip>
        <div style={{ height: 250 }}><FitText text={headline} max={88} min={44} style={{ fontWeight: 800, color: C.white, letterSpacing: -2 }} /></div>
      </AbsoluteFill>
      {/* phone frame with the app screen recording (or the logo until recordings exist) */}
      <div style={{ position: "absolute", left: 250, top: 610, width: 580, height: 940, borderRadius: 64, border: `16px solid ${C.ink}`, background: C.white, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 40px 100px rgba(0,0,0,.30)" }}>
        {recording ? <OffthreadVideo src={staticFile(recording)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <Img src={logoUrl ?? staticFile("logo.svg")} style={{ width: 300, height: 300, borderRadius: 64, objectFit: "contain" }} />}
      </div>
      {beats.map((beat, i) => (
        <Sequence key={i} from={i * BEAT_FRAMES} durationInFrames={BEAT_FRAMES} layout="none">
          <Beat text={beat} />
        </Sequence>
      ))}
      <div style={{ position: "absolute", left: 80, right: 80, top: 1640, height: 16, borderRadius: 8, background: "rgba(255,255,255,.22)" }}>
        <div style={{ height: "100%", width: `${Math.min(100, (frame / Math.max(1, durationInFrames - END_FRAMES)) * 100)}%`, borderRadius: 8, background: C.white }} />
      </div>
      <Sequence from={endStart} layout="none">
        <AbsoluteFill style={{ background: C.tealDark, alignItems: "center", justifyContent: "center", gap: 48, opacity: spring({ frame: frame - endStart, fps, durationInFrames: 15 }) }}>
          <Img src={staticFile("logo.svg")} style={{ width: 280, height: 280, borderRadius: 64 }} />
          <div style={{ fontWeight: 800, fontSize: 80, color: C.white }}>{brandName || "Your brand"}</div>
          <div style={{ fontWeight: 500, fontSize: 48, color: C.mintSoft, textAlign: "center", padding: "0 80px" }}>{ctaText || "Follow for the next useful idea."}</div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

const Beat: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, durationInFrames: 12 });
  return (
    <div style={{ position: "absolute", left: 80, right: 80, bottom: 120, height: 360, background: C.white, borderRadius: 32, padding: "28px 40px", transform: `translateY(${(1 - enter) * 80}px)`, opacity: enter, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
      <FitText text={text} max={64} min={30} style={{ fontWeight: 800, color: C.tealDark, display: "flex", alignItems: "center" }} />
    </div>
  );
};
