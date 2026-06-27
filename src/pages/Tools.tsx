import DeliverabilityCheck from "../components/DeliverabilityCheck";
import StackBuilder from "../components/sections/StackBuilder";

export default function Tools() {
  return (
    <>
      {/* Free email deliverability checker — funnels into the app */}
      <DeliverabilityCheck />

      {/* Plan recommender */}
      <StackBuilder />
    </>
  );
}
