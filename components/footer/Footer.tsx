import { NAV_LINKS } from "@/lib/demo";

export default function Footer() {
  const cols = [
    { title: "Product", links: ["Pools", "Backtest", "Strategies", "Dashboard"] },
    { title: "Resources", links: ["Docs", "Status", "Guides", "Changelog"] },
    { title: "Company", links: ["About", "Legal", "Privacy", "Terms"] },
  ];
  return (
    <footer id="resources" className="border-t border-carbon-line bg-carbon-soft/40">
      <div className="container-x py-14 grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-lg">LiquidAI</span>
          </div>
          <p className="muted text-[14px] mt-4 max-w-xs">
            Autonomous Uniswap v3 liquidity management. Liquidity that manages itself.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="mono text-[12px] uppercase tracking-wider text-ivory/45">{c.title}</h4>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l}>
                  <a href="#" className="text-[14px] text-ivory/70 hover:text-ivory transition-colors duration-200">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-x py-6 border-t border-carbon-line flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="mono text-[12px] text-ivory/40">© 2026 LiquidAI</span>
        <span className="mono text-[11px] text-ivory/30">Demo environment · not financial advice</span>
      </div>
    </footer>
  );
}
