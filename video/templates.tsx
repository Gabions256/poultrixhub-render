import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FitText, fontFamily } from "./FitText";

export const C = { mint: "#3DDC97", mintSoft: "#E6FBF2", teal: "#0F766E", tealDark: "#0B4F4A", ink: "#12302D", white: "#FFFFFF" };
export const SIZES = { portrait: { width: 1080, height: 1350 }, vertical: { width: 1080, height: 1920 } } as const;
export type Size = keyof typeof SIZES;

export type CardProps = { headline: string; body: string; size: Size };
export type SlideProps = { text: string; index: number; total: number; size: Size; cta?: boolean };
export type VideoProps = { headline: string; beats: string[]; recording?: string };

export const BEAT_FRAMES = 135; // 4.5 s at 30 fps
export const END_FRAMES = 90;

const Brand: React.FC<{ light?: boolean }> = ({ light }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily, fontWeight: 800, fontSize: 40, color: light ? C.white : C.tealDark }}>
    <Img src={staticFile("logo.svg")} style={{ width: 84, height: 84, borderRadius: 20 }} />
    PoultrixHub
  </div>
);

const Footer: React.FC<{ light?: boolean }> = ({ light }) => (
  <div style={{ fontFamily, fontWeight: 500, fontSize: 34, color: light ? C.mintSoft : C.teal }}>
    Free on Google Play · search <b>PoultrixHub</b>
  </div>
);

const Chip: React.FC<{ children: string; dark?: boolean }> = ({ children, dark }) => (
  <div style={{ alignSelf: "flex-start", fontFamily, fontWeight: 800, fontSize: 30, letterSpacing: 3, padding: "10px 24px", borderRadius: 999, background: dark ? C.tealDark : C.mintSoft, color: dark ? C.mint : C.teal }}>
    {children}
  </div>
);

const pad = 80;

/** Image 1: farm tip / install ask. Mint card on white. */
export const TipCard: React.FC<CardProps> = ({ headline, body }) => (
  <AbsoluteFill style={{ background: C.white, padding: pad, display: "flex", flexDirection: "column", gap: 40 }}>
    <Brand />
    <div style={{ flex: 1, minHeight: 0, background: `linear-gradient(160deg, ${C.mint}, ${C.teal})`, borderRadius: 48, padding: 64, display: "flex", flexDirection: "column", gap: 32 }}>
      <Chip dark>FARM TIP</Chip>
      <div style={{ flex: 3, minHeight: 0 }}><FitText text={headline} max={120} min={48} style={{ fontWeight: 800, color: C.white }} /></div>
      <div style={{ flex: 2, minHeight: 0 }}><FitText text={body} max={52} min={26} style={{ fontWeight: 500, color: C.mintSoft, lineHeight: 1.3 }} /></div>
    </div>
    <Footer />
  </AbsoluteFill>
);

/** Image 2: calculator demo. Teal background, white panel with a big headline. */
export const StatCard: React.FC<CardProps> = ({ headline, body }) => (
  <AbsoluteFill style={{ background: C.tealDark, padding: pad, display: "flex", flexDirection: "column", gap: 40 }}>
    <Brand light />
    <Chip>FREE CALCULATOR</Chip>
    <div style={{ flex: 1, minHeight: 0, background: C.white, borderRadius: 48, padding: 64, display: "flex", flexDirection: "column", gap: 32, borderLeft: `24px solid ${C.mint}` }}>
      <div style={{ flex: 3, minHeight: 0 }}><FitText text={headline} max={120} min={48} style={{ fontWeight: 800, color: C.tealDark }} /></div>
      <div style={{ flex: 2, minHeight: 0 }}><FitText text={body} max={52} min={26} style={{ fontWeight: 500, color: C.ink, lineHeight: 1.3 }} /></div>
    </div>
    <Footer light />
  </AbsoluteFill>
);

/** Image 3: problem and fix. Two stacked panels. */
export const ProblemFixCard: React.FC<CardProps> = ({ headline, body }) => (
  <AbsoluteFill style={{ background: C.mintSoft, padding: pad, display: "flex", flexDirection: "column", gap: 32 }}>
    <Brand />
    <div style={{ flex: 1, minHeight: 0, background: C.white, borderRadius: 40, padding: 56, display: "flex", flexDirection: "column", gap: 20 }}>
      <Chip>THE PROBLEM</Chip>
      <div style={{ flex: 1, minHeight: 0 }}><FitText text={headline} max={100} min={44} style={{ fontWeight: 800, color: C.ink }} /></div>
    </div>
    <div style={{ flex: 1, minHeight: 0, background: C.teal, borderRadius: 40, padding: 56, display: "flex", flexDirection: "column", gap: 20 }}>
      <Chip dark>THE FIX</Chip>
      <div style={{ flex: 1, minHeight: 0 }}><FitText text={body} max={60} min={26} style={{ fontWeight: 500, color: C.white, lineHeight: 1.3 }} /></div>
    </div>
    <Footer />
  </AbsoluteFill>
);

/** Carousel slide. The last slide (cta) is the install ask. */
export const CarouselSlide: React.FC<SlideProps> = ({ text, index, total, cta }) => (
  <AbsoluteFill style={{ background: cta ? `linear-gradient(160deg, ${C.mint}, ${C.teal})` : C.white, padding: pad, display: "flex", flexDirection: "column", gap: 40 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Brand light={cta} />
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
    <Footer light={cta} />
  </AbsoluteFill>
);

/** 15–30 s vertical video: headline, 3–5 on-screen beats over a phone frame, end card. */
export const PromoVideo: React.FC<VideoProps> = ({ headline, beats, recording }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 40]);
  const endStart = durationInFrames - END_FRAMES;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${160 + drift}deg, ${C.mint}, ${C.tealDark})`, fontFamily }}>
      <AbsoluteFill style={{ padding: "120px 80px 0", display: "flex", flexDirection: "column", gap: 40 }}>
        <Brand light />
        <div style={{ height: 300 }}><FitText text={headline} max={88} min={44} style={{ fontWeight: 800, color: C.white }} /></div>
      </AbsoluteFill>
      {/* phone frame with the app screen recording (or the logo until recordings exist) */}
      <div style={{ position: "absolute", left: 230, top: 600, width: 620, height: 1000, borderRadius: 64, border: `18px solid ${C.ink}`, background: C.white, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {recording ? <OffthreadVideo src={staticFile(recording)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <Img src={staticFile("logo.svg")} style={{ width: 300, height: 300, borderRadius: 64 }} />}
      </div>
      {beats.map((beat, i) => (
        <Sequence key={i} from={i * BEAT_FRAMES} durationInFrames={BEAT_FRAMES} layout="none">
          <Beat text={beat} />
        </Sequence>
      ))}
      <Sequence from={endStart} layout="none">
        <AbsoluteFill style={{ background: C.tealDark, alignItems: "center", justifyContent: "center", gap: 48, opacity: spring({ frame: frame - endStart, fps, durationInFrames: 15 }) }}>
          <Img src={staticFile("logo.svg")} style={{ width: 280, height: 280, borderRadius: 64 }} />
          <div style={{ fontWeight: 800, fontSize: 80, color: C.white }}>PoultrixHub</div>
          <div style={{ fontWeight: 500, fontSize: 48, color: C.mintSoft, textAlign: "center", padding: "0 80px" }}>Free on Google Play.<br />Search PoultrixHub.</div>
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
