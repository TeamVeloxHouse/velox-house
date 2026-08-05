import Hero from "../components/sections/Hero";
import ProductFilm from "../components/sections/ProductFilm";
import SocialProof from "../components/sections/SocialProof";
import ProductTiles from "../components/sections/ProductTiles";
import AiEverywhere from "../components/sections/AiEverywhere";
import MobileCapable from "../components/sections/MobileCapable";
import VolleySections from "../components/sections/VolleySections";
import StatsBar from "../components/sections/StatsBar";
import ProblemsSolver from "../components/sections/ProblemsSolver";
import DeliverabilityCheck from "../components/DeliverabilityCheck";
import RoiCalculator from "../components/RoiCalculator";
import StackBuilder from "../components/sections/StackBuilder";
import Pricing from "../components/sections/Pricing";
import FinalCTA from "../components/sections/FinalCTA";

export default function Home() {
  return (
    <>
      <Hero />
      <ProductFilm />
      <SocialProof />
      {/* Free instant-value tool, early — it captures the visitors who aren't
          ready to buy yet. */}
      <DeliverabilityCheck variant="home" />
      <ProductTiles />
      <AiEverywhere />
      <MobileCapable />
      <VolleySections />
      <StatsBar />
      <ProblemsSolver />
      {/* "What's it worth?" sits between the problem and the price. */}
      <RoiCalculator variant="home" />
      <StackBuilder />
      <Pricing />
      <FinalCTA />
    </>
  );
}
