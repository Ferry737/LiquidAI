import Navbar from "@/components/navigation/Navbar";
import Hero from "@/components/hero/Hero";
import MetricsStrip from "@/components/metrics/MetricsStrip";
import ProductStatement from "@/components/features/ProductStatement";
import Rebalancing from "@/components/features/Rebalancing";
import Dashboard from "@/components/dashboard/Dashboard";
import HowItWorks from "@/components/workflow/HowItWorks";
import StrategyEngine from "@/components/strategy-engine/StrategyEngine";
import Backtest from "@/components/backtest/Backtest";
import OnChain from "@/components/blockchain/OnChain";
import Alerts from "@/components/alerts/Alerts";
import MultiChain from "@/components/chains/MultiChain";
import Security from "@/components/features/Security";
import FinalCTA from "@/components/cta/FinalCTA";
import Footer from "@/components/footer/Footer";

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <MetricsStrip />
        <ProductStatement />
        <Rebalancing />
        <Dashboard />
        <HowItWorks />
        <StrategyEngine />
        <Backtest />
        <OnChain />
        <Alerts />
        <MultiChain />
        <Security />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
