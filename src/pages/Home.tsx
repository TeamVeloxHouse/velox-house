import Hero from "../components/sections/Hero";
import SocialProof from "../components/sections/SocialProof";
import ProductTiles from "../components/sections/ProductTiles";
import AiEverywhere from "../components/sections/AiEverywhere";
import MobileCapable from "../components/sections/MobileCapable";
import VolleySections from "../components/sections/VolleySections";
import StatsBar from "../components/sections/StatsBar";
import ProblemsSolver from "../components/sections/ProblemsSolver";
import StackBuilder from "../components/sections/StackBuilder";
import FreeTier from "../components/sections/FreeTier";
import Pricing from "../components/sections/Pricing";
import FinalCTA from "../components/sections/FinalCTA";

export default function Home() {
  return (
    <>
      <Hero />
      <SocialProof />
      <ProductTiles />
      <AiEverywhere />
      <MobileCapable />
      <VolleySections />
      <StatsBar />
      <ProblemsSolver />
      <StackBuilder />
      <FreeTier />
      <Pricing />
      <FinalCTA />
    </>
  );
}
