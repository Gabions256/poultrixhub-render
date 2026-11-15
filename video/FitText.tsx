import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily, waitUntilDone } = loadFont("normal", { weights: ["500", "800"], subsets: ["latin"] });
export { fontFamily };

/**
 * Fills its box with `text`, shrinking the font until nothing overflows.
 * If the text still overflows at `min`, the render fails instead of shipping clipped text.
 */
export const FitText: React.FC<{ text: string; max: number; min: number; style?: CSSProperties }> = ({ text, max, min, style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(max);
  const [handle] = useState(() => delayRender(`fit text: ${text.slice(0, 30)}`));
  const done = useRef(false);

  useLayoutEffect(() => {
    if (done.current) return;
    waitUntilDone().then(() => {
      const el = ref.current;
      if (!el) return;
      const overflows = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      if (!overflows) {
        done.current = true;
        continueRender(handle);
      } else if (size <= min) {
        cancelRender(new Error(`Text overflows at ${min}px: "${text.slice(0, 60)}"`));
      } else {
        setSize((s) => Math.max(min, s - 2));
      }
    });
  }, [size, min, text, handle]);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", overflow: "hidden", overflowWrap: "break-word", fontFamily, fontSize: size, lineHeight: 1.15, ...style }}>
      {text}
    </div>
  );
};
