import React, { useEffect, useState, useRef } from "react";
import { useUI } from "../../context/UIContext.js";
import { Check, Link2, Leaf, Zap, Crown, Gem, Sparkles, FileText, Files, GraduationCap, FileSignature, BarChart3, Briefcase, Star, Heart, Gift, Award, Shield, Flame, Rocket } from "lucide-react";
import { Header } from "../../components/layout/Layout.js";
import "../../css/pricing-page.css";

interface ContactLink {
  linkText: string;
  linkUrl: string;
}

interface PricingContent {
  id: string;
  number: number;
  text: string;
  links: ContactLink[];
}

export const PricingPage: React.FC = () => {
  const { themeMode } = useUI();
  const [content, setContent] = useState<PricingContent[]>([]);
  const [loading, setLoading] = useState(true);
  const tiers = [
    {
      name: "Gói Free",
      price: "0đ",
      savings: "Mặc định khi đăng ký",
      icon: "free",
      features: [
        "Xem tối đa 10 câu hỏi/ngày",
        "Tỷ lệ câu hỏi hiển thị giới hạn (20%)",
        "Quảng cáo cơ bản",
      ],
    },
    {
      name: "Gói Plus",
      price: "99.000đ",
      savings: "Phù hợp ôn tập nhanh (30 ngày)",
      icon: "plus",
      features: [
        "Mở khóa bộ câu hỏi đã chọn trong 30 ngày",
        "Xem tối đa 100 câu hỏi/ngày",
        "Xem đáp án chi tiết và giải thích đầy đủ",
        "Không có quảng cáo phiền toái",
      ],
    },
    {
      name: "Gói Pro",
      price: "249.000đ",
      savings: "Tiết kiệm hơn (90 ngày)",
      icon: "pro",
      features: [
        "Mở khóa toàn bộ danh mục tài liệu đã chọn",
        "Không giới hạn số câu hỏi xem mỗi ngày",
        "Xem đáp án chi tiết và giải thích đầy đủ",
        "Hỗ trợ học tập trực tiếp từ Admin",
      ],
    },
    {
      name: "Gói Ultra",
      price: "399.000đ",
      savings: "Đầy đủ đặc quyền VIP (180 ngày)",
      icon: "ultra",
      features: [
        "Mở khóa toàn bộ tài nguyên trên hệ thống",
        "Không giới hạn số câu hỏi xem mỗi ngày",
        "Ưu tiên hỗ trợ kỹ thuật và giải đáp 24/7",
        "Nhận đề thi thử & tài liệu ôn tập độc quyền",
      ],
    },
  ];
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Compute actual dark mode
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      const dark = themeMode === "dark" || 
        (themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setIsDark(dark);
    };

    checkDark();

    if (themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", checkDark);
      return () => mediaQuery.removeEventListener("change", checkDark);
    }
  }, [themeMode]);

  // Use mock content data directly - no API calls
  const mockContentData: PricingContent[] = [
    {
      id: "1",
      number: 1,
      text: "Liên hệ Admin trực tiếp qua Zalo để được tư vấn và hỗ trợ học tập từ HOU. Học mọi lúc, mọi nơi.",
      links: [{ linkText: "Zalo 0876236682", linkUrl: "https://zalo.me/0876236682" }],
    },
    {
      id: "2",
      number: 2,
      text: "Lập tài khoản người dùng để trải nghiệm đầy đủ tính năng của hệ thống.",
      links: [{ linkText: "Đăng ký tài khoản", linkUrl: "/login" }],
    },
    {
      id: "3",
      number: 3,
      text: "Ứng hộ tôi với lý do yêu thích hệ thống học tập và tranh thủ cơ hội nâng cấp tài khoản.",
      links: [],
    },
  ];

  useEffect(() => {
    setLoading(false);
    setContent(mockContentData);
  }, []);

  const scrollPremiumTiers = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container || container.children.length === 0) return;

    const cardWidth = (container.children[0] as HTMLElement).offsetWidth;
    const gap = 32;
    const scrollAmount = cardWidth + gap;

    const currentScroll = container.scrollLeft;
    const currentIndex = Math.round(currentScroll / scrollAmount);

    let newIndex;
    if (direction === "left") {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(container.children.length - 1, currentIndex + 1);
    }

    const newScroll = newIndex * scrollAmount;
    container.scrollTo({ left: newScroll, behavior: "smooth" });
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "free":
        return <Leaf className="w-8 h-8 text-gray-500" />;
      case "plus":
        return <Zap className="w-8 h-8 text-purple-500" />;
      case "pro":
        return <Crown className="w-8 h-8 text-amber-500" />;
      case "ultra":
        return <Gem className="w-8 h-8 text-blue-500" />;
      case "star":
        return <Star className="w-8 h-8 text-yellow-500" />;
      case "heart":
        return <Heart className="w-8 h-8 text-rose-500" />;
      case "gift":
        return <Gift className="w-8 h-8 text-pink-500" />;
      case "award":
        return <Award className="w-8 h-8 text-emerald-500" />;
      case "shield":
        return <Shield className="w-8 h-8 text-teal-500" />;
      case "flame":
        return <Flame className="w-8 h-8 text-orange-500" />;
      case "rocket":
        return <Rocket className="w-8 h-8 text-indigo-500" />;
      case "sparkles":
        return <Sparkles className="w-8 h-8 text-emerald-500" />;
      default:
        return <Sparkles className="w-8 h-8 text-emerald-500" />;
    }
  };

  const renderContentItem = (item: PricingContent) => {
    const text = item.text || "";
    const links = item.links || [];

    // Filter links that are present in the text to be rendered inline
    const inlineLinks = links.filter(link => link.linkText && text.includes(link.linkText));
    // Filter out inline links from the list of links rendered at the bottom
    const remainingLinks = links.filter(link => !inlineLinks.some(il => il.linkText === link.linkText));

    const renderTextWithLinks = () => {
      if (inlineLinks.length === 0) {
        return <p className="whitespace-pre-line leading-relaxed">{text}</p>;
      }

      // Escape special characters for regex
      const escapeRegExp = (str: string) => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      };

      // Sort inline links by length descending to match longer substrings first
      const sortedInlineLinks = [...inlineLinks].sort((a, b) => b.linkText.length - a.linkText.length);
      const pattern = sortedInlineLinks.map(l => `(${escapeRegExp(l.linkText)})`).join("|");
      const regex = new RegExp(pattern, "g");

      const parts = text.split(regex);

      return (
        <p className="whitespace-pre-line leading-relaxed">
          {parts.map((part, index) => {
            if (!part) return null;

            const matchingLink = inlineLinks.find(link => link.linkText === part);
            if (matchingLink) {
              return (
                <a
                  key={index}
                  href={matchingLink.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5 mx-1"
                >
                  <Link2 className="w-3.5 h-3.5 inline-block align-text-top" />
                  {part}
                </a>
              );
            }

            return part;
          })}
        </p>
      );
    };

    return (
      <li key={item.id} className="info-item">
        <span className="info-number">{item.number}</span>
        <div className="info-content text-sm text-[var(--fg-2)]">
          {renderTextWithLinks()}
          {remainingLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {remainingLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-500/5 px-2.5 py-0.5 rounded-md"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{link.linkText}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex-1 min-w-0 w-full flex flex-col doc-main-bg">
        <Header 
          title="Liên hệ"
          hideLogo={true}
          onOpenSettings={() => window.dispatchEvent(new Event("open-settings"))}
          onOpenProfile={() => window.dispatchEvent(new Event("open-profile"))}
        />
        <div className="flex-1 p-6 gap-6 flex flex-col overflow-y-auto">
        <div className={`pricing-page ${isDark ? "dark" : "light"} bg-transparent min-h-0`}>
          <main className="pricing-main-content !p-0">
            <div className="max-w-7xl mx-auto px-4">
          
          {/* Premium Packages Section */}
          <div className="mb-12">
            <div className="pricing-hero">
              <h1 className={`pricing-title ${isDark ? "dark" : "light"}`}>
                Gói người dùng cao cấp
              </h1>
              <p className="pricing-subtitle text-[var(--fg-2)]">
                Nâng cấp tài khoản để trải nghiệm đầy đủ tính năng và ưu đãi đặc biệt
              </p>
            </div>

            <div className="pricing-carousel-container">
              {/* Navigation buttons */}
              <button
                onClick={() => scrollPremiumTiers("left")}
                className={`carousel-nav-btn prev ${isDark ? "dark" : "light"}`}
                aria-label="Previous"
              >
                <span className="text-lg">&lt;</span>
              </button>

              <button
                onClick={() => scrollPremiumTiers("right")}
                className={`carousel-nav-btn next ${isDark ? "dark" : "light"}`}
                aria-label="Next"
              >
                <span className="text-lg">&gt;</span>
              </button>

              <div ref={scrollContainerRef} className="pricing-scroll-area">
                {tiers.map((tier, index) => (
                  <div
                    key={index}
                    className={`pricing-card border border-[var(--border)] ${isDark ? "dark" : "light"}`}
                  >
                    <div className="card-header">
                      <div className={`card-icon-wrapper ${isDark ? "dark" : "light"}`}>
                        {getIcon(tier.icon)}
                      </div>
                      <h3 className="card-title text-[var(--fg)]">{tier.name}</h3>
                      <div className="card-price">{tier.price}</div>
                      <p className="text-xs text-[var(--fg-2)] mt-1">{tier.savings}</p>
                    </div>

                    <div className="card-features">
                      <ul className="feature-list">
                        {tier.features && tier.features.map((feature: string, fIdx: number) => (
                          <li key={fIdx} className="feature-item text-[var(--fg-2)]">
                            <Check className="feature-icon w-4 h-4" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {tier.price !== "0đ" && tier.price !== "0" && (
                      <a
                        href="https://zalo.me/0971485601"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card-button block text-center"
                      >
                        Đăng ký ngay
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing Content Section */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="text-sm text-[var(--fg-2)]">Đang tải hướng dẫn...</p>
            </div>
          ) : (
            content.length > 0 && (
              <div id="instructions" className="mt-16">
                <div className="pricing-hero">
                  <h2 className={`pricing-title section-title ${isDark ? "dark" : "light"}`}>
                    Thông tin chuyển khoản &amp; kích hoạt
                  </h2>
                </div>

                <div className={`pricing-info-section border border-[var(--border)] ${isDark ? "dark" : "light"}`}>
                  <ul className="space-y-4">
                    {content.map((item) => renderContentItem(item))}
                  </ul>
                </div>
              </div>
            )
          )}

          {/* Support Section */}
          <div className="services-section mt-16">
            <div className="pricing-hero">
              <h2 className={`pricing-title section-title ${isDark ? "dark" : "light"}`}>
                Hỗ trợ
              </h2>
              <p className="pricing-subtitle text-[var(--fg-2)]">
                Chúng tôi cung cấp hỗ trợ toàn diện cho học tập và công việc của bạn
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className={`service-card border border-[var(--border)] ${isDark ? "dark" : "light"}`}>
                <div className={`service-icon ${isDark ? "dark" : "light"}`}>
                  <FileText className="w-8 h-8" />
                </div>
                <h4 className="service-title text-[var(--fg)]">
                  Hỗ trợ full 9/10 tất cả các môn hệ thống
                </h4>
              </div>

              <div className={`service-card border border-[var(--border)] ${isDark ? "dark" : "light"}`}>
                <div className={`service-icon ${isDark ? "dark" : "light"}`}>
                  <Files className="w-8 h-8" />
                </div>
                <h4 className="service-title text-[var(--fg)]">
                  Hỗ trợ đề cương trong thời gian học
                </h4>
              </div>

              <div className={`service-card border border-[var(--border)] ${isDark ? "dark" : "light"}`}>
                <div className={`service-icon ${isDark ? "dark" : "light"}`}>
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h4 className="service-title text-[var(--fg)]">
                  Hỗ trợ thi kết thúc môn học full điểm các môn
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`service-card border border-[var(--border)] ${isDark ? "dark" : "light"}`}>
                <div className={`service-icon ${isDark ? "dark" : "light"}`}>
                  <FileSignature className="w-8 h-8" />
                </div>
                <h4 className="service-title text-[var(--fg)]">
                  Hỗ trợ đồ án full 9/10
                </h4>
              </div>

              <div className={`service-card border border-[var(--border)] ${isDark ? "dark" : "light"}`}>
                <div className={`service-icon ${isDark ? "dark" : "light"}`}>
                  <BarChart3 className="w-8 h-8" />
                </div>
                <h4 className="service-title text-[var(--fg)]">
                  Báo cáo thực tập, chuyên đề thực tập, luận văn thạc sĩ tất cả các chuyên ngành
                </h4>
              </div>

              <div className={`service-card border border-[var(--border)] ${isDark ? "dark" : "light"}`}>
                <div className={`service-icon ${isDark ? "dark" : "light"}`}>
                  <Briefcase className="w-8 h-8" />
                </div>
                <h4 className="service-title text-[var(--fg)]">
                  Dịch vụ kế toán, tư vấn khi ra trường, tư vấn pháp lý
                </h4>
              </div>
            </div>
          </div>

            </div>
          </main>
        </div>
        </div>
      </div>
  );
};

export default PricingPage;
