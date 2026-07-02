import { Composition } from "remotion";
import { VeloxHero } from "./VeloxHero";

// ~25s advert @ 30fps, 1920x1080: brand → hook → 4 feature beats → CTA.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VeloxHero"
      component={VeloxHero}
      durationInFrames={748}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
