import { Composition } from "remotion";
import { VeloxHero } from "./VeloxHero";

// Total: 360 frames @ 30fps = 12s. 1920x1080 for a crisp marketing hero.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VeloxHero"
      component={VeloxHero}
      durationInFrames={360}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
