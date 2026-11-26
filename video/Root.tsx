import { Composition, type CalculateMetadataFunction } from "remotion";
import { BEAT_FRAMES, END_FRAMES, CarouselSlide, ProblemFixCard, PromoVideo, SIZES, StatCard, TipCard, type CardProps, type Size, type SlideProps, type VideoProps } from "./templates";

const sized = <P extends { size: Size }>({ props }: { props: P }) => SIZES[props.size];
const videoLength: CalculateMetadataFunction<VideoProps> = ({ props }) => ({ durationInFrames: props.beats.length * BEAT_FRAMES + END_FRAMES });

const card: CardProps = { headline: "Weigh 10 birds every week, not just one", body: "A sample of 10 tells you far more about your flock. Log weights in PoultrixHub and FCR is worked out for you.", eyebrow: "FARM TIP", size: "portrait" };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="TipCard" component={TipCard} defaultProps={card} calculateMetadata={sized} fps={30} durationInFrames={1} width={1080} height={1350} />
    <Composition id="StatCard" component={StatCard} defaultProps={card} calculateMetadata={sized} fps={30} durationInFrames={1} width={1080} height={1350} />
    <Composition id="ProblemFixCard" component={ProblemFixCard} defaultProps={card} calculateMetadata={sized} fps={30} durationInFrames={1} width={1080} height={1350} />
    <Composition id="CarouselSlide" component={CarouselSlide} defaultProps={{ text: "Feed is most of your cost. Know it per bird.", index: 1, total: 4, size: "portrait" } as SlideProps} calculateMetadata={sized} fps={30} durationInFrames={1} width={1080} height={1350} />
    <Composition id="PromoVideo" component={PromoVideo} defaultProps={{ headline: "Log deaths in 2 taps", eyebrow: "FARM SMARTER", beats: ["Lost count of deaths again?", "Open PoultrixHub, tap Record", "Mortality is worked out for you"] } as VideoProps} calculateMetadata={videoLength} fps={30} durationInFrames={BEAT_FRAMES * 3 + END_FRAMES} width={1080} height={1920} />
  </>
);
