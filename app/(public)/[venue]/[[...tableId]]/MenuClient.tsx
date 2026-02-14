"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { fmtTRY } from "@/lib/format";

/** ======= Visual tokens to match the mock ======= */
const COLORS = {
  maroon: "#8D1F25",      // header & accents
  maroonDark: "#7B1B20",
  text: "#263238",        // primary copy (slate-ish)
  muted: "#5E6B73",       // secondary copy
  baseBorder: "#E6E6E6",  // card & input borders
  chip: "#E9ECEF",        // image placeholder bg
  card: "#FFFFFF",
};

// Subtle crumpled paper texture
const paperBg =
  "radial-gradient(circle at 18% 12%, rgba(0,0,0,0.04) 0 1px, transparent 1px 100%)," +
  "radial-gradient(circle at 78% 20%, rgba(0,0,0,0.035) 0 1px, transparent 1px 100%)," +
  "radial-gradient(circle at 28% 86%, rgba(0,0,0,0.03) 0 1px, transparent 1px 100%)," +
  "linear-gradient(0deg, rgba(255,255,255,0.96), rgba(255,255,255,0.96))";

/** =============================================== */

type Product = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  imageUrl?: string;
  isInStock: boolean;
  dietTags?: string[];
  category?: string;
  categoryId?: string | null;
  subCategoryId?: string | null;
};

type Category = {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string;
  displayOrder?: number;
};

type SubCategory = {
  id: string;
  venueId: string;
  categoryId: string;
  slug: string;
  name: string;
  displayOrder?: number;
};

type CartEntry = {
  product: Product;
  quantity: number;
};

type Venue = {
  id: string;
  name: string;
  slug: string;
  announcement?: string | null;
  openingHours?: string | null;
};

type CartOptions = Record<string, unknown>;
type CartAddEventDetail = { id: string; options?: CartOptions };
type CartRemoveEventDetail = { id: string };

type CartWindow = Window & {
  addToCart?: (productId: string, options?: CartOptions) => void;
  removeFromCart?: (productId: string) => void;
  openCart?: () => void;
};

const sortByPriceDesc = (items: Product[]) =>
  [...items].sort((a, b) => {
    if (b.priceCents !== a.priceCents) return b.priceCents - a.priceCents;
    return a.name.localeCompare(b.name);
  });

const normalizeProductCategory = (category?: string | null) => {
  if (!category) return undefined;
  const lower = category.toLowerCase();
  if (lower === 'coffee') return 'hot';
  if (lower === 'dessert') return 'dessert';
  if (lower === 'cold') return 'cold';
  if (lower === 'hot') return 'hot';
  return lower.replace(/\s+/g, '-');
};

const resolveImageSrc = (url?: string | null) => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.r2.dev')) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  } catch {
    return url;
  }
};

export default function MenuClient({
  venue,
  products,
  categories,
  subCategories = [],
}: {
  venue: Venue;
  products: Product[];
  categories: Category[];
  subCategories?: SubCategory[];
}) {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>(categories[0]?.slug ?? "");
  const [selectedSubCat, setSelectedSubCat] = useState<string>("ALL");
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [sheetReady, setSheetReady] = useState(false);
  const [sheetQuantity, setSheetQuantity] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [cartItems, setCartItems] = useState<Record<string, CartEntry>>({});
  const [cartSheetVisible, setCartSheetVisible] = useState(false);
  const [cartSheetReady, setCartSheetReady] = useState(false);
  const announceRef = useRef<HTMLDivElement>(null);
  const sheetCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetAnimationFrame = useRef<number | null>(null);
  const cartCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartAnimationFrame = useRef<number | null>(null);

  const incrementSheetQuantity = useCallback(() => {
    setSheetQuantity((qty) => qty + 1);
  }, []);

  const decrementSheetQuantity = useCallback(() => {
    setSheetQuantity((qty) => Math.max(0, qty - 1));
  }, []);

  const closeSheet = useCallback(() => {
    if (!sheetProduct) return;
    setSheetReady(false);
    if (sheetAnimationFrame.current !== null) {
      cancelAnimationFrame(sheetAnimationFrame.current);
      sheetAnimationFrame.current = null;
    }
    if (sheetCloseTimer.current) {
      clearTimeout(sheetCloseTimer.current);
    }
    sheetCloseTimer.current = setTimeout(() => {
      setSheetProduct(null);
      sheetCloseTimer.current = null;
    }, 220);
  }, [sheetProduct]);

  const closeCartSheet = useCallback(() => {
    if (!cartSheetVisible) return;
    setCartSheetReady(false);
    if (cartAnimationFrame.current !== null) {
      cancelAnimationFrame(cartAnimationFrame.current);
      cartAnimationFrame.current = null;
    }
    if (cartCloseTimer.current) {
      clearTimeout(cartCloseTimer.current);
    }
    cartCloseTimer.current = setTimeout(() => {
      setCartSheetVisible(false);
      cartCloseTimer.current = null;
    }, 220);
  }, [cartSheetVisible]);

  useEffect(() => {
    if (sheetProduct) {
      setSheetQuantity(0);
      setDescriptionExpanded(false);
    }
  }, [sheetProduct]);

  useEffect(() => {
    if (!selectedCat) return;
    const exists = categories.some((c) => c.slug === selectedCat);
    if (!exists) {
      setSelectedCat(categories[0]?.slug ?? "");
    }
  }, [categories, selectedCat]);

  useEffect(() => {
    if (!selectedCat) return;
    const selectedCategory = categories.find((c) => c.slug === selectedCat);
    if (!selectedCategory) {
      setSelectedSubCat("ALL");
      return;
    }
    const allowed = subCategories
      .filter((s) => s.categoryId === selectedCategory.id)
      .map((s) => s.slug);
    if (allowed.length === 0) {
      if (selectedSubCat !== "ALL") setSelectedSubCat("ALL");
      return;
    }
    if (selectedSubCat !== "ALL" && !allowed.includes(selectedSubCat)) {
      setSelectedSubCat("ALL");
    }
  }, [categories, selectedCat, selectedSubCat, subCategories]);

  useEffect(() => {
    if (sheetAnimationFrame.current !== null) {
      cancelAnimationFrame(sheetAnimationFrame.current);
      sheetAnimationFrame.current = null;
    }

    if (sheetProduct) {
      if (sheetCloseTimer.current) {
        clearTimeout(sheetCloseTimer.current);
        sheetCloseTimer.current = null;
      }
      setSheetReady(false);
      sheetAnimationFrame.current = window.requestAnimationFrame(() => {
        setSheetReady(true);
        sheetAnimationFrame.current = null;
      });
    } else {
      setSheetReady(false);
    }

    return () => {
      if (sheetAnimationFrame.current !== null) {
        cancelAnimationFrame(sheetAnimationFrame.current);
        sheetAnimationFrame.current = null;
      }
    };
  }, [sheetProduct]);

  useEffect(() => {
    if (cartAnimationFrame.current !== null) {
      cancelAnimationFrame(cartAnimationFrame.current);
      cartAnimationFrame.current = null;
    }

    if (cartSheetVisible) {
      if (cartCloseTimer.current) {
        clearTimeout(cartCloseTimer.current);
        cartCloseTimer.current = null;
      }
      setCartSheetReady(false);
      cartAnimationFrame.current = window.requestAnimationFrame(() => {
        setCartSheetReady(true);
        cartAnimationFrame.current = null;
      });
    } else {
      setCartSheetReady(false);
    }

    return () => {
      if (cartAnimationFrame.current !== null) {
        cancelAnimationFrame(cartAnimationFrame.current);
        cartAnimationFrame.current = null;
      }
    };
  }, [cartSheetVisible]);

  useEffect(() => {
    return () => {
      if (sheetCloseTimer.current) {
        clearTimeout(sheetCloseTimer.current);
      }
      if (sheetAnimationFrame.current !== null) {
        cancelAnimationFrame(sheetAnimationFrame.current);
      }
      if (cartCloseTimer.current) {
        clearTimeout(cartCloseTimer.current);
      }
      if (cartAnimationFrame.current !== null) {
        cancelAnimationFrame(cartAnimationFrame.current);
      }
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const categoryMaps = useMemo(() => {
    const idToSlug: Record<string, string> = {};
    const slugToImage: Record<string, string | undefined> = {};
    const subIdToSlug: Record<string, string> = {};
    const subSlugToName: Record<string, string> = {};
    const categorySlugToSubCategories: Record<string, SubCategory[]> = {};

    categories.forEach((c) => {
      if (c.id) idToSlug[c.id] = c.slug;
      if (c.slug && !slugToImage[c.slug]) {
        slugToImage[c.slug] = c.imageUrl || `/images/categories/${c.slug}.jpg`;
      }
    });
    subCategories.forEach((s) => {
      if (s.id) subIdToSlug[s.id] = s.slug;
      if (s.slug) subSlugToName[s.slug] = s.name;
      const categorySlug = idToSlug[s.categoryId];
      if (!categorySlug) return;
      if (!categorySlugToSubCategories[categorySlug]) {
        categorySlugToSubCategories[categorySlug] = [];
      }
      categorySlugToSubCategories[categorySlug].push(s);
    });
    Object.keys(categorySlugToSubCategories).forEach((key) => {
      categorySlugToSubCategories[key] = [...categorySlugToSubCategories[key]].sort((a, b) => {
        const aOrder = a.displayOrder ?? 0;
        const bOrder = b.displayOrder ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      });
    });
    products.forEach((p) => {
      const key = normalizeProductCategory(p.category);
      if (key && !slugToImage[key] && p.imageUrl) {
        slugToImage[key] = p.imageUrl;
      }
    });
    return { idToSlug, slugToImage, subIdToSlug, subSlugToName, categorySlugToSubCategories };
  }, [categories, products, subCategories]);

  const resolveProductCategory = useCallback(
    (product: Product) => {
      if (product.categoryId && categoryMaps.idToSlug[product.categoryId]) {
        return categoryMaps.idToSlug[product.categoryId];
      }
      return normalizeProductCategory(product.category);
    },
    [categoryMaps]
  );

  const resolveProductSubCategory = useCallback(
    (product: Product) => {
      if (product.subCategoryId && categoryMaps.subIdToSlug[product.subCategoryId]) {
        return categoryMaps.subIdToSlug[product.subCategoryId];
      }
      return undefined;
    },
    [categoryMaps]
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch;
    const result = products.filter((p) => {
      const categorySlug = resolveProductCategory(p);
      const subCategorySlug = resolveProductSubCategory(p);
      if (selectedCat && categorySlug !== selectedCat) {
        return false;
      }
      if (selectedCat && selectedSubCat !== "ALL" && subCategorySlug !== selectedSubCat) {
        return false;
      }
      return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    });
    return sortByPriceDesc(result);
  }, [products, debouncedSearch, selectedCat, selectedSubCat, resolveProductCategory, resolveProductSubCategory]);

  const groupedFiltered = useMemo(() => {
    if (!selectedCat || selectedSubCat !== "ALL") return [];
    const grouped = new Map<string, Product[]>();
    filtered.forEach((product) => {
      const subSlug = resolveProductSubCategory(product) ?? "uncategorized";
      if (!grouped.has(subSlug)) grouped.set(subSlug, []);
      grouped.get(subSlug)?.push(product);
    });

    const entries = Array.from(grouped.entries()).map(([slug, items]) => ({
      slug,
      name: slug === "uncategorized" ? "Diğer" : categoryMaps.subSlugToName[slug] ?? slug,
      items,
    }));

    const orderMap = new Map(
      (categoryMaps.categorySlugToSubCategories[selectedCat] || []).map((s, idx) => [s.slug, idx])
    );

    return entries.sort((a, b) => {
      const aOrder = orderMap.has(a.slug) ? (orderMap.get(a.slug) as number) : Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.has(b.slug) ? (orderMap.get(b.slug) as number) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
  }, [categoryMaps.categorySlugToSubCategories, categoryMaps.subSlugToName, filtered, resolveProductSubCategory, selectedCat, selectedSubCat]);

  const cartSummary = useMemo(() => {
    const entries = Object.values(cartItems);
    const count = entries.reduce((acc, entry) => acc + entry.quantity, 0);
    const total = entries.reduce((acc, entry) => acc + entry.quantity * entry.product.priceCents, 0);
    return { count, total, entries };
  }, [cartItems]);

  const handleAdd = (product: Product, options: CartOptions = {}, quantity = 1) => {
    if (quantity <= 0) {
      return;
    }
    const cartWindow = window as CartWindow;
    for (let i = 0; i < quantity; i += 1) {
      if (typeof cartWindow.addToCart === "function") {
        cartWindow.addToCart(product.id, options);
      } else {
        window.dispatchEvent(
          new CustomEvent<CartAddEventDetail>("menu:add", { detail: { id: product.id, options } })
        );
      }
    }
    setCartItems((prev) => {
      const next = { ...prev };
      const current = next[product.id];
      next[product.id] = {
        product,
        quantity: current ? current.quantity + quantity : quantity,
      };
      return next;
    });
    if (announceRef.current) {
      announceRef.current.textContent =
        quantity === 1
          ? `${product.name} sepete eklendi`
          : `${quantity} adet ${product.name} sepete eklendi`;
    }
    closeSheet();
  };

  const handleRemove = (product: Product, currentQuantity?: number) => {
    const effectiveQty =
      typeof currentQuantity === "number" ? currentQuantity : cartItems[product.id]?.quantity ?? 0;
    if (effectiveQty <= 1) {
      const confirmed =
        typeof window === "undefined" || typeof window.confirm !== "function"
          ? true
          : window.confirm(`${product.name} sepetten kaldırılacak. Emin misiniz?`);
      if (!confirmed) {
        return;
      }
    }
    const cartWindow = window as CartWindow;
    if (typeof cartWindow.removeFromCart === "function") {
      cartWindow.removeFromCart(product.id);
    } else {
      window.dispatchEvent(
        new CustomEvent<CartRemoveEventDetail>("menu:remove", { detail: { id: product.id } })
      );
    }
    setCartItems((prev) => {
      const current = prev[product.id];
      if (!current) {
        return prev;
      }
      const next = { ...prev };
      if (current.quantity <= 1) {
        delete next[product.id];
      } else {
        next[product.id] = {
          product,
          quantity: current.quantity - 1,
        };
      }
      return next;
    });
  };

  const openCartBar = useCallback(() => {
    if (!cartSummary.count) return;
    const cartWindow = window as CartWindow;
    if (typeof cartWindow.openCart === "function") {
      cartWindow.openCart();
    } else {
      window.dispatchEvent(new CustomEvent("menu:cart:open"));
    }
    setCartSheetVisible(true);
  }, [cartSummary.count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSheet();
        closeCartSheet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSheet, closeCartSheet]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    if (sheetProduct || cartSheetVisible) {
      body.style.overflow = "hidden";
    } else {
      body.style.overflow = previousOverflow;
    }
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [sheetProduct, cartSheetVisible]);

  const shouldClampDescription =
    !!sheetProduct?.description && sheetProduct.description.length > 200;

  /** =================== Main =================== */
  return (
    <div className="pb-24" style={{ background: paperBg, color: COLORS.text }}>
      <div className="sr-only" aria-live="polite" ref={announceRef} />

      {/* Header */}
      {/* Header (sticky only for the bars) */}
     {/* Header (only maroon bar stays sticky) */}
      <header className="sticky top-0 z-20">
        <div
          className="text-white flex items-center justify-center h-12 px-4"
          style={{ backgroundColor: COLORS.maroon }}
        >
          <div className="text-center font-semibold w-full">{venue.name}</div>
        </div>
      </header>

      {/* MENÜ label (no longer sticky) */}
      <div className="text-center font-bold py-2" style={{ color: COLORS.text }}>
        MENÜ
      </div>

      {/* Search */}
      {/* Search */}
<div className="px-4 pt-2 pb-2">
  <div className="relative mx-auto" style={{ width: "calc(100% - 5cm)" }}>
    <input
      id="search-input"
      className="w-full h-9 pr-12 pl-4 rounded-full outline-none text-center text-lg"
      style={{
        border: "2px solid black",
        background: "transparent",
        color: "black",
      }}
      placeholder={search || searchFocused ? "" : "Ara"}
      value={search}
      onChange={(e) => {
        const val = e.target.value;
        setSearch(val);
      }}
      onFocus={() => setSearchFocused(true)}
      onBlur={() => setSearchFocused(false)}
    />

    {/* Search Icon */}
    <button
      type="button"
      className="absolute right-4 top-1/2 -translate-y-1/2"
      aria-label="Search"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="black"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
    </button>
  </div>
</div>




      {/* Categories */}
      <nav
        className="cat-scroll flex gap-2 overflow-x-auto px-4 py-2"
        role="tablist"
        aria-label="Menu categories"
      >
        {categories.map((cat) => {
          const active = selectedCat === cat.slug;
          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={active}
              className="flex flex-col items-center flex-shrink-0 w-24"
              data-category={cat.slug}
              onClick={() => {
                setSelectedCat(cat.slug);
                setSelectedSubCat("ALL");
              }}
            >
              <div
                className="w-20 h-16 rounded-xl overflow-hidden mb-2"
                style={{
                  border: `4px solid ${active ? COLORS.maroon : "transparent"}`,
                }}
              >
                {categoryMaps.slugToImage[cat.slug] ? (
                  <Image
                    src={resolveImageSrc(categoryMaps.slugToImage[cat.slug]) || categoryMaps.slugToImage[cat.slug]!}
                    alt={cat.name}
                    width={96}
                    height={80}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full" style={{ background: COLORS.chip }} />
                )}
              </div>
              <span
                className="text-sm font-medium text-center leading-tight"
                style={{
                  color: active ? COLORS.maroon : COLORS.text,
                }}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Category hero */}
      {selectedCat && (
        <div className="px-4 flex flex-col items-center">
          <div
            className="relative w-full rounded-xl overflow-hidden"
            style={{ maxWidth: "100%", height: "126px" }}
          >
            {categoryMaps.slugToImage[selectedCat] ? (
              <Image
                src={resolveImageSrc(categoryMaps.slugToImage[selectedCat]) || categoryMaps.slugToImage[selectedCat]!}
                alt={categories.find((c) => c.slug === selectedCat)?.name || selectedCat}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full" style={{ background: COLORS.chip }} />
            )}
          </div>
          <div
            className="mt-2 text-center font-semibold italic"
            style={{ color: COLORS.maroon, fontSize: "22px" }}
          >
            {categories.find((c) => c.slug === selectedCat)?.name || selectedCat}
          </div>
        </div>
      )}

      {selectedCat && (categoryMaps.categorySlugToSubCategories[selectedCat]?.length ?? 0) > 0 && (
        <nav
          className="cat-scroll flex gap-2 overflow-x-auto px-4 py-1"
          role="tablist"
          aria-label="Alt kategoriler"
        >
          <button
            role="tab"
            aria-selected={selectedSubCat === "ALL"}
            className="px-3 py-1 rounded-full text-sm border"
            onClick={() => setSelectedSubCat("ALL")}
            style={{
              borderColor: selectedSubCat === "ALL" ? COLORS.maroon : COLORS.baseBorder,
              color: selectedSubCat === "ALL" ? COLORS.maroon : COLORS.text,
              background: selectedSubCat === "ALL" ? "#fff5f5" : "#fff",
            }}
          >
            Tümü
          </button>
          {categoryMaps.categorySlugToSubCategories[selectedCat].map((sub) => (
            <button
              key={sub.id}
              role="tab"
              aria-selected={selectedSubCat === sub.slug}
              className="px-3 py-1 rounded-full text-sm border whitespace-nowrap"
              onClick={() => setSelectedSubCat(sub.slug)}
              style={{
                borderColor: selectedSubCat === sub.slug ? COLORS.maroon : COLORS.baseBorder,
                color: selectedSubCat === sub.slug ? COLORS.maroon : COLORS.text,
                background: selectedSubCat === sub.slug ? "#fff5f5" : "#fff",
              }}
            >
              {sub.name}
            </button>
          ))}
        </nav>
      )}

      <style jsx>{`
        .cat-scroll::-webkit-scrollbar {
          display: none;
        }
        .cat-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Items */}
      <section
          className="p-4 flex flex-col gap-3"
          aria-label="Ürün listesi"
        >
          {selectedSubCat === "ALL" && groupedFiltered.length > 0
            ? groupedFiltered.map((group) => (
                <div key={group.slug} className="space-y-2">
                  <h3 className="text-sm font-semibold px-1" style={{ color: COLORS.maroon }}>
                    {group.name}
                  </h3>
                  {group.items.map((p) => (
                    <article
                      key={p.id}
                      className="rounded-xl p-3 flex items-center gap-3"
                      style={{ backgroundColor: "#ded9d9" }}
                    >
                      <button
                        onClick={() => setSheetProduct(p)}
                        className="flex items-center w-full text-left"
                      >
                        {p.imageUrl ? (
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                            <Image
                              src={resolveImageSrc(p.imageUrl) || p.imageUrl}
                              alt={p.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : null}
                        <div className={`flex flex-col flex-1 ${p.imageUrl ? "ml-3" : ""}`}>
                          <h2 className="font-semibold text-base mb-1" style={{ color: COLORS.text }}>
                            {p.name}
                          </h2>
                          {p.description && (
                            <p className="text-sm line-clamp-2" style={{ color: COLORS.muted }}>
                              {p.description}
                            </p>
                          )}
                          <span className="mt-1 font-semibold text-sm" style={{ color: COLORS.text }}>
                            {fmtTRY(p.priceCents)}
                          </span>
                        </div>
                      </button>
                    </article>
                  ))}
                </div>
              ))
            : filtered.map((p) => (
                <article
                  key={p.id}
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{
                    backgroundColor: "#ded9d9",
                  }}
                >
                  <button
                    onClick={() => setSheetProduct(p)}
                    className="flex items-center w-full text-left"
                  >
                    {p.imageUrl ? (
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <Image
                          src={resolveImageSrc(p.imageUrl) || p.imageUrl}
                          alt={p.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : null}
                    <div className={`flex flex-col flex-1 ${p.imageUrl ? "ml-3" : ""}`}>
                      <h2 className="font-semibold text-base mb-1" style={{ color: COLORS.text }}>
                        {p.name}
                      </h2>
                      {p.description && (
                        <p className="text-sm line-clamp-2" style={{ color: COLORS.muted }}>
                          {p.description}
                        </p>
                      )}
                      <span className="mt-1 font-semibold text-sm" style={{ color: COLORS.text }}>
                        {fmtTRY(p.priceCents)}
                      </span>
                    </div>
                  </button>
                </article>
              ))}
        </section>



      {/* Product Sheet */}
      {sheetProduct && (
        <div
          className={`fixed inset-0 z-30 flex items-end justify-center px-4 pb-6 sm:items-center transition-opacity duration-300 ${
            sheetReady ? "opacity-100" : "opacity-0"
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
          onClick={closeSheet}
          style={{
            backgroundColor: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-300 ${
              sheetReady ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
            onClick={(event) => event.stopPropagation()}
            style={{ height: "70vh", maxHeight: "560px" }}
          >
            <div className="flex h-full flex-col overflow-hidden">
              <div className="relative h-52 w-full">
                {sheetProduct.imageUrl ? (
                  <Image
                    src={resolveImageSrc(sheetProduct.imageUrl) || sheetProduct.imageUrl}
                    alt={sheetProduct.name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 384px, 100vw"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: COLORS.chip }} />
                )}
                <button
                  type="button"
                  onClick={closeSheet}
                  aria-label="Kapat"
                  className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-700 shadow-md transition hover:bg-white"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6" style={{ color: COLORS.text }}>
                <h2 id="sheet-title" className="text-2xl font-semibold">
                  {sheetProduct.name}
                </h2>
                <div className="mt-2 text-lg font-semibold" style={{ color: COLORS.maroon }}>
                  {fmtTRY(sheetProduct.priceCents)}
                </div>
                {sheetProduct.description && (
                  <div
                    className="mt-4 text-sm leading-relaxed relative"
                    style={{ color: COLORS.muted }}
                  >
                    <p className={!descriptionExpanded && shouldClampDescription ? "line-clamp-4" : ""}>
                      {sheetProduct.description}
                    </p>
                    {shouldClampDescription && !descriptionExpanded && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
                    )}
                    {shouldClampDescription && (
                      <button
                        type="button"
                        className="mt-2 text-sm font-semibold"
                        style={{ color: COLORS.maroon }}
                        onClick={() => setDescriptionExpanded((prev) => !prev)}
                      >
                        {descriptionExpanded ? "Daha az göster" : "Devamını gör"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="px-6 pb-6 pt-4" style={{ borderTop: `1px solid ${COLORS.baseBorder}` }}>
                <div className="flex items-center justify-between pb-4">
                  <span className="text-sm font-semibold" style={{ color: COLORS.text }}>
                    Adet
                  </span>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={decrementSheetQuantity}
                      aria-label="Adedi azalt"
                      className="grid h-10 w-10 place-items-center rounded-full border transition hover:bg-slate-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ borderColor: COLORS.baseBorder, color: COLORS.text }}
                      disabled={sheetQuantity === 0}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <span className="w-10 text-center text-base font-semibold" style={{ color: COLORS.text }}>
                      {sheetQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={incrementSheetQuantity}
                      aria-label="Adedi artır"
                      className="grid h-10 w-10 place-items-center rounded-full border transition hover:bg-slate-100 active:scale-[0.97]"
                      style={{ borderColor: COLORS.baseBorder, color: COLORS.text }}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleAdd(sheetProduct, {}, sheetQuantity)}
                  disabled={sheetQuantity === 0}
                  className="h-12 w-full rounded-xl text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: COLORS.maroon }}
                >
                  Sepete ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sheet */}
      {cartSheetVisible && (
        <div
          className={`fixed inset-0 z-40 flex items-end justify-center px-4 pb-6 sm:items-center transition-opacity duration-300 ${
            cartSheetReady ? "opacity-100" : "opacity-0"
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-sheet-title"
          onClick={closeCartSheet}
          style={{
            backgroundColor: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-300 ${
              cartSheetReady ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
            onClick={(event) => event.stopPropagation()}
            style={{ maxHeight: "min(80vh, 640px)" }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between px-6 pb-4 pt-6" style={{ borderBottom: `1px solid ${COLORS.baseBorder}` }}>
                <div>
                  <h2 id="cart-sheet-title" className="text-xl font-semibold" style={{ color: COLORS.text }}>
                    Sepet
                  </h2>
                  <p className="text-sm" style={{ color: COLORS.muted }}>
                    {cartSummary.count} ürün • {fmtTRY(cartSummary.total)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCartSheet}
                  aria-label="Sepeti kapat"
                  className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {cartSummary.entries.length === 0 ? (
                  <div className="text-center text-sm" style={{ color: COLORS.muted }}>
                    Sepetiniz boş.
                  </div>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {cartSummary.entries.map((entry) => (
                      <li key={entry.product.id} className="flex items-center gap-3">
                        <div className="relative h-14 w-14 overflow-hidden rounded-xl">
                          {entry.product.imageUrl ? (
                            <Image
                              src={resolveImageSrc(entry.product.imageUrl) || entry.product.imageUrl}
                              alt={entry.product.name}
                              fill
                              className="object-cover"
                              sizes="56px"
                              unoptimized
                            />
                          ) : (
                            <div className="h-full w-full" style={{ background: COLORS.chip }} />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm font-semibold" style={{ color: COLORS.text }}>
                            {entry.product.name}
                          </span>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                aria-label="Adedi azalt"
          onClick={() => handleRemove(entry.product, entry.quantity)}
                                className="grid h-9 w-9 place-items-center rounded-full border transition hover:bg-slate-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ borderColor: COLORS.baseBorder, color: COLORS.text }}
                                disabled={entry.quantity <= 0}
                              >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M5 12h14" />
                                </svg>
                              </button>
                              <span className="text-sm font-semibold" style={{ color: COLORS.text }}>
                                {entry.quantity}
                              </span>
                              <button
                                type="button"
                                aria-label="Adedi artır"
                                onClick={() => handleAdd(entry.product, {}, 1)}
                                className="grid h-9 w-9 place-items-center rounded-full border transition hover:bg-slate-100 active:scale-[0.97]"
                                style={{ borderColor: COLORS.baseBorder, color: COLORS.text }}
                              >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 5v14" />
                                  <path d="M5 12h14" />
                                </svg>
                              </button>
                            </div>
                            <span className="text-sm font-semibold" style={{ color: COLORS.text }}>
                              {fmtTRY(entry.quantity * entry.product.priceCents)}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="px-6 pb-6 pt-4" style={{ borderTop: `1px solid ${COLORS.baseBorder}` }}>
                <div className="flex items-center justify-between text-sm font-semibold" style={{ color: COLORS.text }}>
                  <span>Toplam</span>
                  <span>{fmtTRY(cartSummary.total)}</span>
                </div>
                <button
                  type="button"
                  className="mt-4 h-12 w-full rounded-xl text-base font-semibold text-white transition active:scale-[0.99]"
                  style={{ backgroundColor: COLORS.maroon }}
                  onClick={closeCartSheet}
                >
                  Sepeti kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart bar */}
      {cartSummary.count > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-20 text-white px-4 py-3 flex items-center justify-between"
          style={{
            backgroundColor: COLORS.maroon,
            paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
          }}
        >
          <div>
            {cartSummary.count} ürün • {fmtTRY(cartSummary.total)}
          </div>
          <button
            type="button"
            onClick={openCartBar}
            aria-label="Sepeti aç"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/70 transition active:scale-[0.97]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="19" cy="20" r="1.5" />
              <path d="M1.5 3h3l2.4 12.5a2 2 0 0 0 2 1.6H18a2 2 0 0 0 2-1.7L21.5 7.5H5.1" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
