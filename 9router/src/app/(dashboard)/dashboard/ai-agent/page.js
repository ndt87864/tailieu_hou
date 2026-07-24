"use client";

import Link from "next/link";
import { Card } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";

export default function AIAgentSelectorPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-8 px-4 w-full">
      <div className="text-center sm:text-left mb-4">
        <h1 className="text-2xl font-bold mb-2">AI Agent báo cáo</h1>
        <p className="text-text-muted">Chọn provider để sử dụng AI Agent</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/dashboard/providers/luna" className="group block">
          <Card className="h-full hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors p-8 flex flex-col items-center justify-center gap-6 cursor-pointer border border-border group-hover:border-primary/40">
            <div className="size-20 rounded-2xl flex items-center justify-center bg-black/5 dark:bg-white/5 shadow-sm">
              <ProviderIcon
                src="/providers/luna.png"
                alt="Luna"
                size={56}
                className="object-contain rounded-xl"
                fallbackText="LN"
                fallbackColor="#24292f"
              />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">Luna Provider</h2>
              <p className="text-sm text-text-muted mt-2">Truy cập vào các model chuyên dụng từ Luna</p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
