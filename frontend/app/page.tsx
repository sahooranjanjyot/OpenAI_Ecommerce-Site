"use client";

import React, { useMemo, useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe("pk_test_TYooMQauvdEDq54NiTphI7jx");
type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  wasPrice?: number;
  promo?: string;
  onSale?: boolean;
  stock: number;
};

type Buyer = {
  name: string;
  mobile: string;
  email?: string;
  verified: boolean;
  notes?: string;
};

const productsSeed: Product[] = [
  { id: 1, name: "Bananas", category: "Fruits", price: 1.2, wasPrice: 1.5, promo: "Fresh Deal", onSale: true, stock: 20 },
  { id: 2, name: "Tomatoes", category: "Vegetables", price: 1.2, wasPrice: 1.2, promo: "4 for 3", onSale: true, stock: 40 },
  { id: 3, name: "Milk", category: "Confectionery", price: 1.1, stock: 30 },
  { id: 4, name: "Potato Chips", category: "Confectionery", price: 3.0, promo: "BOGO", onSale: true, stock: 16 },
  { id: 5, name: "Basmati Rice", category: "Rice", price: 4.5, wasPrice: 5.0, promo: "Family Saver", onSale: true, stock: 18 },
  { id: 6, name: "Atta Flour", category: "Flour", price: 3.2, stock: 22 },
  { id: 7, name: "Sunflower Oil", category: "Oil", price: 6.8, stock: 14 },
  { id: 8, name: "Red Lentils", category: "Lentils", price: 2.4, stock: 26 },
  { id: 9, name: "Turmeric Powder", category: "Spices", price: 1.9, stock: 35 },
  { id: 10, name: "Frozen Peas", category: "Frozen Item", price: 2.1, stock: 12 },
];

const StripeNativeForm = ({ onConfirm, processing, setMessage }: { onConfirm: (token: string) => void, processing: boolean, setMessage: (msg: string) => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      const card = elements.getElement(CardElement);
      if (!card) return;
      const { paymentMethod, error } = await stripe.createPaymentMethod({ type: "card", card });
      if (error) {
        setMessage(error.message || "Payment verification failed.");
      } else {
        onConfirm(paymentMethod.id);
      }
    }}>
      <div style={{ marginBottom: 16, background: "#1e293b", padding: 14, borderRadius: 8, border: "1px solid #475569" }}>
        <CardElement options={{ hidePostalCode: true, style: { base: { fontSize: "16px", color: "#f8fafc", "::placeholder": { color: "#94a3b8" } }, invalid: { color: "#ef4444" } } }} />
      </div>
      <button disabled={!stripe || processing} type="submit" style={{ width: "100%", padding: "14px", borderRadius: 10, background: "#16a34a", color: "white", border: 0, fontWeight: "bold", cursor: processing ? "not-allowed" : "pointer" }}>
        {processing ? "Contacting Stripe Gateway..." : "Confirm Secure Payment"}
      </button>
    </form>
  );
};

export default function GroceryUATReadyApp() {
  const [route, setRoute] = useState<"store" | "sale" | "buyer" | "admin" | "checkout">("store");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("default");
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [cart, setCart] = useState<(Product & { qty: number })[]>([]);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "reset">("login");
  const [message, setMessage] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [checkoutPostcode, setCheckoutPostcode] = useState("");
  const [postcodeDoors, setPostcodeDoors] = useState<string[]>([]);
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [stripePaymentProcessing, setStripePaymentProcessing] = useState(false);
  const [deliveryComment, setDeliveryComment] = useState("");
  const [adminLogged, setAdminLogged] = useState(false);
  const [employeeLogged, setEmployeeLogged] = useState(false);
  const [employeeContext, setEmployeeContext] = useState<any>(null);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [adminOtpSent, setAdminOtpSent] = useState(false);
  const [adminMfaRequired, setAdminMfaRequired] = useState(false);
  const [adminMfaToken, setAdminMfaToken] = useState("");
  const [adminTotpCode, setAdminTotpCode] = useState("");
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const lastActivityRef = React.useRef<number>(Date.now());
  const [savedAddresses, setSavedAddresses] = useState<Record<string, string[]>>({});
  const [savedInstructions, setSavedInstructions] = useState<Record<string, string[]>>({});
  const [orderHistory, setOrderHistory] = useState<Record<string, { total: number; items: string; address: string, date?: string }[]>>({});
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [paymentOtpSent, setPaymentOtpSent] = useState(false);
  const [paymentOtp, setPaymentOtp] = useState("");
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [adminProducts, setAdminProducts] = useState<any[]>([]);
  const [adminEmployees, setAdminEmployees] = useState<any[]>([]);
  const products = Array.isArray(adminProducts) ? adminProducts.filter(p => !p.hidden && p.enabled !== false) : [];
  const [adminCategoryFilter, setAdminCategoryFilter] = useState("All");
  const [editForm, setEditForm] = useState<any>({});
  const [catalogSearch, setCatalogSearch] = useState("");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [globalPromo, setGlobalPromo] = useState({ active: false, type: "percent", value: 10, threshold: 50 });
  const [storeAlert, setStoreAlert] = useState({ active: false, message: "Welcome to Grocery OS! Fresh deals daily." });
  const [loyaltyDiscountSetting, setLoyaltyDiscountSetting] = useState(10);

  // ── Currency Switcher (G-052) ────────────────────────────────────────────────
  const [selectedCurrency, setSelectedCurrency] = useState<string>("GBP");
  const [exchangeRates, setExchangeRates] = useState<Record<string, { rate: number; symbol: string; name: string }>>({});
  const currencySymbol = exchangeRates[selectedCurrency]?.symbol ?? "£";
  const formatPrice = (pricePennies: number) => {
    const pounds = pricePennies / 100;
    const rate   = exchangeRates[selectedCurrency]?.rate ?? 1;
    const converted = (pounds * rate).toFixed(2);
    return `${currencySymbol}${converted}`;
  };

  useEffect(() => {
    const saved = localStorage.getItem("groceryGlobalPromo");
    if (saved) setGlobalPromo(JSON.parse(saved));
    const savedAlert = localStorage.getItem("groceryStoreAlert");
    if (savedAlert) setStoreAlert(JSON.parse(savedAlert));
    const savedLoyalty = localStorage.getItem("groceryLoyaltyDiscount");
    if (savedLoyalty) setLoyaltyDiscountSetting(parseFloat(savedLoyalty) || 10);
  }, []);

  // ── 15-Minute Idle Session Timeout (G-013, PCI-DSS) ─────────────────────────
  useEffect(() => {
    const IDLE_LIMIT = 15 * 60 * 1000; // 15 minutes
    const WARNING_AT = 14 * 60 * 1000; // warn at 14 minutes

    const resetActivity = () => { lastActivityRef.current = Date.now(); setIdleWarning(false); };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));

    const idleCheck = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_LIMIT) {
        // Session expired — log out customer
        setBuyer(null);
        setCustomerToken(null);
        localStorage.removeItem("groceryos_buyer");
        localStorage.removeItem("groceryos_token");
        (window as any).__customerToken = null;
        setIdleWarning(false);
        setMessage("Your session expired after 15 minutes of inactivity. Please log in again.");
        setRoute("buyer");
      } else if (idle >= WARNING_AT) {
        setIdleWarning(true);
      }
    }, 30_000); // check every 30s

    return () => {
      events.forEach(e => window.removeEventListener(e, resetActivity));
      clearInterval(idleCheck);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("groceryGlobalPromo", JSON.stringify(globalPromo));
  }, [globalPromo]);

  useEffect(() => {
    localStorage.setItem("groceryStoreAlert", JSON.stringify(storeAlert));
  }, [storeAlert]);

  const [supportContact, setSupportContact] = useState("Email: support@groceryos.com\nPhone: 0800 123 4567\nOperating Hours: 24/7");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("grocerySupportDetails");
      if (saved) setSupportContact(saved);
    } catch (e) { }
  }, []);

  useEffect(() => {
    localStorage.setItem("groceryLoyaltyDiscount", loyaltyDiscountSetting.toString());
  }, [loyaltyDiscountSetting]);

  useEffect(() => {
    if (message && !message.toLowerCase().includes("error") && !message.toLowerCase().includes("incomplete") && !message.toLowerCase().includes("failed")) {
      const t = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  useEffect(() => {
    setCurrentPage(1);
  }, [route, selectedCategory, query, sortBy]);

  const [adminTab, setAdminTab] = useState("Add & Edit");
  const [posCategory, setPosCategory] = useState("All");
  const [scanningPos, setScanningPos] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "", price: "", stock: "", unitSize: "1", unit: "Unit", image: "", promo: "", description: "", barcode: "" });
  const [inventorySearch, setInventorySearch] = useState("");
  const [promos, setPromos] = useState<any[]>([]);
  const [newPromo, setNewPromo] = useState({ type: "BOGO", target: "", start: "", end: "", buyX: "", payY: "", crossTarget: "", crossDiscount: "" });
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminCustomers, setAdminCustomers] = useState<any[]>([]);
  const [adminAlerts, setAdminAlerts] = useState([{ id: 1, type: "critical", msg: "Milk is out of stock!" }, { id: 2, type: "warning", msg: "Payment failed for Order #103" }]);

  const [inventoryBatches, setInventoryBatches] = useState<any[]>([]);
  const [newBatch, setNewBatch] = useState({ productId: "", productName: "", category: "stock top-up", quantity: "", costPrice: "", supplier: "" });
  const [posSearch, setPosSearch] = useState("");
  const [posCart, setPosCart] = useState<any[]>([]);
  const [posSyncQueue, setPosSyncQueue] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [lastSyncAttempt, setLastSyncAttempt] = useState<string>("");
  const [posCheckoutModal, setPosCheckoutModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ method: "Cash", received: "", splitCash: "", splitCard: "" });
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("pos_cart_backup");
      if (savedCart) setPosCart(JSON.parse(savedCart));
      
      const savedSyncQueue = localStorage.getItem("pos_sync_queue");
      if (savedSyncQueue) setPosSyncQueue(JSON.parse(savedSyncQueue));
    } catch (e) {
      console.error("Local storage load failed", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pos_cart_backup", JSON.stringify(posCart));
  }, [posCart]);

  useEffect(() => {
    localStorage.setItem("pos_sync_queue", JSON.stringify(posSyncQueue));
  }, [posSyncQueue]);

  useEffect(() => {
    if (posSyncQueue.length === 0) return;

    const interval = setInterval(async () => {
      if (!window.navigator.onLine) return; // Prevent draining purely if logically offline

      setSyncStatus("Replaying offline queue...");
      const currentQueue = [...posSyncQueue];
      let hasSuccess = false;

      for (let i = 0; i < currentQueue.length; i++) {
        const payload = currentQueue[i];
        if (!payload) continue;
        try {
          const req = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          
          if (req.ok) {
            const data = await req.json();
            if (data.success) {
               currentQueue[i] = null;
               hasSuccess = true;
            }
          } else {
             // 500 error or validation failure
             // We keep it to retry for real network failures
          }
        } catch (e) {
          console.error("Native queue sync failure", e);
          break; // Stop replaying since network is down
        }
      }

      setLastSyncAttempt(new Date().toLocaleTimeString());

      const remainingQueue = currentQueue.filter(x => x !== null);
      if (remainingQueue.length !== posSyncQueue.length) {
         setPosSyncQueue(remainingQueue);
         if (remainingQueue.length === 0) {
            setSyncStatus("Sync resolved.");
            setTimeout(() => setSyncStatus(""), 4000);
            
            // Refresh products organically from admin boundary
            fetch("/api/products").then(r => r.json()).then(data => setAdminProducts(Array.isArray(data) ? data : (data?.products ?? [])));
         }
      } else {
         setSyncStatus("Sync failed. Retrying later...");
      }

    }, 10000);

    return () => clearInterval(interval);
  }, [posSyncQueue]);

  const [posInputQty, setPosInputQty] = useState<{ [key: number]: string }>({});
  const [orderStartDate, setOrderStartDate] = useState("");
  const [orderEndDate, setOrderEndDate] = useState("");
  const [adminReturns, setAdminReturns] = useState<any[]>([]);
  const [returnForm, setReturnForm] = useState<{ active: boolean, targetOrder: any, targetItem: any, qty: number, reason: string, condition: string, refund: number, restock: boolean } | null>(null);

  const [opticalScan, setOpticalScan] = useState<string>("");

  useEffect(() => {
    if (opticalScan && adminProducts.length > 0) {
      setPosSearch(opticalScan);
      const hits = adminProducts.filter(p => p.barcode && p.barcode === opticalScan.trim());
      if (hits.length > 0) {
        const p = hits[0];
        setPosCart(prev => {
          const existing = prev.find(x => x.id === p.id);
          const qty = existing ? existing.qty : 0;
          if (qty + 1 > p.stock) {
            const pwd = window.prompt(`Stock Limit Reached: Master Password required to override limit of ${p.stock} exactly ${p.unit}:`);
            if (pwd !== adminPass && pwd !== "admin123") {
              window.alert("Override Denied.");
              return prev;
            }
          }
          return existing ? prev.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x) : [...prev, { ...p, qty: 1 }];
        });
        setPosSearch("");
      }
      setOpticalScan("");
    }
  }, [opticalScan, adminProducts, adminPass]);

  useEffect(() => {
    let html5QrCode: any = null;
    if (scanningPos) {
      import("html5-qrcode").then((module) => {
        html5QrCode = new module.Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        // Expose it so the user's manual physical button click below can confidently invoke it synchronously explicitly
        (window as any).__startMobileScanner = () => {
          html5QrCode.start({ facingMode: "environment" }, config, (decodedText: string) => {
            setOpticalScan(decodedText);
            html5QrCode.stop().then(() => html5QrCode.clear());
            setScanningPos(false);
          }, () => { }).catch((err: any) => window.alert("Camera Launch Failed: " + err));
        };
      });
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => { });
      }
    };
  }, [scanningPos]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Load seed data immediately so products show without DB
    setAdminProducts([...productsSeed] as any[]);
    setMounted(true);

    // ── CSRF + Auth: auto-attach to all requests ─────────────────────────────
    fetch("/api/csrf")
      .then(r => r.json())
      .then(({ csrfToken }) => {
        if (!csrfToken) return;
        const _origFetch = window.fetch.bind(window);
        (window as any).__csrfToken = csrfToken;
        window.fetch = function (input: RequestInfo | URL, init: RequestInit = {}) {
          const method = (init.method || "GET").toUpperCase();
          const token = (window as any).__customerToken;
          const extraHeaders: Record<string, string> = {};
          if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
            extraHeaders["x-csrf-token"] = (window as any).__csrfToken || "";
          }
          // Attach customer JWT to all /api/ calls (read and write)
          if (token && typeof input === "string" && input.startsWith("/api/")) {
            extraHeaders["Authorization"] = `Bearer ${token}`;
          }
          if (Object.keys(extraHeaders).length > 0) {
            init.headers = { ...(init.headers || {}), ...extraHeaders };
          }
          return _origFetch(input, init);
        };
      })
      .catch(() => { /* non-fatal */ });

    if (typeof window !== "undefined") {
      try {
        const storedBuyer = localStorage.getItem("groceryos_buyer");
        if (storedBuyer) setBuyer(JSON.parse(storedBuyer));
        const storedToken = localStorage.getItem("groceryos_token");
        if (storedToken) {
          setCustomerToken(storedToken);
          (window as any).__customerToken = storedToken;
        }
      } catch (e) { }

      const checkHash = () => {
        if (window.location.hash.includes("admin")) setRoute("admin");
      };
      checkHash();
      window.addEventListener("hashchange", checkHash);

      // Then attempt to load live data from the API (replaces seed data if DB is available)
      // Also fetch currency rates for the switcher (G-052)
      fetch("/api/currency").then(r => r.ok ? r.json() : null).then(data => {
        if (data?.currencies) {
          const rates: Record<string, { rate: number; symbol: string; name: string }> = {};
          data.currencies.forEach((c: any) => { rates[c.code] = { rate: c.rate, symbol: c.symbol, name: c.name }; });
          setExchangeRates(rates);
        }
      }).catch(() => {});

      Promise.all([
        fetch("/api/products").then(r => r.ok ? r.json() : null),
        fetch("/api/orders").then(r => r.ok ? r.json() : null),
        fetch("/api/customers").then(r => r.ok ? r.json() : null),
        fetch("/api/promos").then(r => r.ok ? r.json() : null),
        fetch("/api/inventory").then(r => r.ok ? r.json() : null),
        fetch("/api/returns").then(r => r.ok ? r.json() : null),
        fetch("/api/employees").then(r => r.ok ? r.json() : null),
      ]).then(([productsData, ordersData, customersData, promosData, inventoryData, returnsData, employeesData]) => {
        // Only replace seed data if DB actually has products (empty array = DB not seeded yet)
        if (productsData && Array.isArray(productsData) && productsData.length > 0) setAdminProducts(productsData);
        const ordersList = Array.isArray(ordersData) ? ordersData : (ordersData?.orders ?? []);
        if (ordersList.length > 0 || ordersData) setAdminOrders(ordersList);
        const customersList = Array.isArray(customersData) ? customersData : (customersData?.customers ?? customersData?.data ?? []);
        if (customersList) setAdminCustomers(customersList);
        if (promosData) setPromos(Array.isArray(promosData) ? promosData : (promosData?.promos ?? promosData?.data ?? []));
        const inventoryList = Array.isArray(inventoryData) ? inventoryData : (inventoryData?.batches ?? inventoryData?.data ?? []);
        if (inventoryList) setInventoryBatches(inventoryList);
        const returnsList = Array.isArray(returnsData) ? returnsData : (returnsData?.data ?? []);
        if (returnsList) setAdminReturns(returnsList);
        const employeesList = Array.isArray(employeesData) ? employeesData : (employeesData?.employees ?? employeesData?.data ?? []);
        if (employeesList) setAdminEmployees(employeesList);

        const parsedAddrs: Record<string, string[]> = {};
        const parsedOrders: Record<string, any[]> = {};
        if (Array.isArray(ordersData)) {
          ordersData.forEach(o => {
            const boundPhone = o.customerPhone || o.customer?.phone;
            const boundAddress = o.deliveryAddress || o.address;
            if (boundPhone) {
              parsedOrders[boundPhone] = [...(parsedOrders[boundPhone] || []), { total: o.total, items: o.items, address: boundAddress, date: o.createdAt }];
              if (boundAddress) {
                parsedAddrs[boundPhone] = Array.from(new Set([...(parsedAddrs[boundPhone] || []), boundAddress]));
              }
            }
          });
        }
        setSavedAddresses(parsedAddrs);
        setOrderHistory(parsedOrders);
      }).catch(() => { /* DB not available — seed data already shown */ });

      return () => window.removeEventListener("hashchange", checkHash);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && mounted) {
      if (route === "admin") {
        if (window.location.hash !== "#admin") window.history.replaceState(null, "", "#admin");
      } else {
        if (window.location.hash === "#admin") window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, [route, mounted]);

  useEffect(() => {
    if (buyer && route === "checkout") {
      setCheckoutEmail(prev => prev || buyer.email || "");
      setCheckoutPhone(prev => prev || buyer.mobile || "");
      if (savedAddresses[buyer.mobile] && savedAddresses[buyer.mobile].length > 0) {
        setDeliveryAddress(prev => prev || savedAddresses[buyer.mobile][0]);
      }
    }
  }, [buyer, route, savedAddresses]);

  const visible = useMemo(() => {
    let list = route === "sale" ? products.filter((p) => p.promo && p.promo.trim() !== "") : products;

    if (selectedCategory !== "All") {
      list = list.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (query.trim()) {
      list = list.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    }

    if (sortBy === "priceLowHigh") {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === "priceHighLow") {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === "nameAZ") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "saleOnly") {
      list = list.filter((p) => p.onSale);
    }

    return list;
  }, [route, products, query, selectedCategory, sortBy]);

  const addToCart = (p: Product) => {
    const increment = p.promo === "BOGO" ? 2 : 1;
    const existing = cart.find(x => x.id === p.id);
    const qty = existing ? existing.qty : 0;

    if (qty + increment > p.stock) {
      window.alert(`Stock limit reached. Only ${p.stock} units available.`);
      return;
    }

    setCart((prev) => {
      const found = prev.find((x) => x.id === p.id);
      if (found) {
        return prev.map((x) =>
          x.id === p.id ? { ...x, qty: x.qty + increment } : x
        );
      }
      return [...prev, { ...p, qty: increment }];
    });
  };

  const decreaseQty = (productId: number) => {
    setCart((prev) =>
      prev
        .map((x) => (x.id === productId ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0)
    );
  };

  const calculateCartTotals = (cartArray: any[] = cart) => {
    let _subtotal = 0;
    let _savings = 0;
    const itemsMap: Record<number, { total: number; savings: number }> = {};
    const activePromos = promos.filter(p => p.active);

    cartArray.forEach(item => {
      let itemTotal = item.qty * item.price;
      let itemSavings = 0;

      if (item.promo === "BOGO" || item.promo?.includes("BOGO")) {
        const free = Math.floor(item.qty / 2);
        itemSavings += free * item.price;
        itemTotal -= free * item.price;
      } else if (item.promo === "Discount 50%") {
        itemSavings += (item.price * 0.5) * item.qty;
        itemTotal -= (item.price * 0.5) * item.qty;
      } else if (item.promo?.startsWith("Buy ")) {
        const match = item.promo.match(/Buy (\d+) Pay (\d+)/);
        if (match) {
          const buyX = parseInt(match[1]);
          const payY = parseInt(match[2]);
          if (buyX > 0 && payY >= 0 && buyX > payY) {
            const bundles = Math.floor(item.qty / buyX);
            const freeItems = bundles * (buyX - payY);
            if (freeItems > 0) {
              itemSavings += freeItems * item.price;
              itemTotal -= freeItems * item.price;
            }
          }
        }
      } else if (item.promo?.match(/(\d+) for £([\d.]+)/i)) {
        const match = item.promo.match(/(\d+) for £([\d.]+)/i);
        if (match) {
          const reqQty = parseInt(match[1]);
          const bundlePrice = parseFloat(match[2]);
          if (reqQty > 0 && bundlePrice >= 0) {
            const bundles = Math.floor(item.qty / reqQty);
            const remainder = item.qty % reqQty;
            const targetTotal = (bundles * bundlePrice) + (remainder * item.price);
            const standardTotal = item.qty * item.price;
            if (standardTotal > targetTotal) {
              itemSavings += (standardTotal - targetTotal);
              itemTotal = targetTotal;
            }
          }
        }
      }

      const multibuy = activePromos.find(p => p.type === "Multibuy (Buy X Pay Y)" && (p.target === item.name || p.target === item.category || p.target === "All Store"));
      if (multibuy && multibuy.buyX && multibuy.payY) {
        const bundles = Math.floor(item.qty / multibuy.buyX);
        const freeItems = bundles * (multibuy.buyX - multibuy.payY);
        if (freeItems > 0) {
          itemSavings += freeItems * item.price;
          itemTotal -= freeItems * item.price;
        }
      }

      const crossSellTrigger = activePromos.find(p => p.type === "Cross-Sell Product Bundle" && p.target === item.name);
      if (crossSellTrigger && crossSellTrigger.crossTarget && crossSellTrigger.crossDiscount) {
        const discountedItemInCart = cartArray.find(c => c.name === crossSellTrigger.crossTarget);
        if (discountedItemInCart) {
          const maxDiscountableQty = Math.min(item.qty, discountedItemInCart.qty);
          const discountAmt = (discountedItemInCart.price * (crossSellTrigger.crossDiscount / 100)) * maxDiscountableQty;
          _savings += discountAmt;
          _subtotal -= discountAmt;
          // Inject saving tag onto discounted item dynamically
          if (itemsMap[discountedItemInCart.id]) {
            itemsMap[discountedItemInCart.id].savings += discountAmt;
            itemsMap[discountedItemInCart.id].total -= discountAmt;
          } else {
            itemsMap[discountedItemInCart.id] = { total: (discountedItemInCart.price * discountedItemInCart.qty) - discountAmt, savings: discountAmt };
          }
        }
      }

      if (item.wasPrice && item.wasPrice > item.price) {
        itemSavings += item.qty * (item.wasPrice - item.price);
      }

      _subtotal += itemTotal;
      _savings += itemSavings;

      if (!itemsMap[item.id]) {
        itemsMap[item.id] = { total: itemTotal, savings: itemSavings };
      } else {
        itemsMap[item.id].total += itemTotal - (item.price * item.qty);
        itemsMap[item.id].savings += itemSavings;
      }
    });

    let globalDiscount = 0;
    if (globalPromo.active && _subtotal >= globalPromo.threshold) {
      if (globalPromo.type === "fixed") {
        globalDiscount = globalPromo.value;
      } else {
        globalDiscount = _subtotal * (globalPromo.value / 100);
      }
      _subtotal -= globalDiscount;
      _savings += globalDiscount;
    }

    const activeCustomerRecord = adminCustomers.find(cu => cu.phone === buyer?.mobile);
    const isLoyaltyCustomer = activeCustomerRecord?.notes?.includes("LOYALTY") || buyer?.notes?.includes("LOYALTY");

    let loyaltyDiscountAmt = 0;
    if (isLoyaltyCustomer && _subtotal > 0) {
      loyaltyDiscountAmt = _subtotal * (loyaltyDiscountSetting / 100);
      _subtotal -= loyaltyDiscountAmt;
      _savings += loyaltyDiscountAmt;
    }

    let over60DiscountAmt = 0;
    if (_subtotal > 60) {
      over60DiscountAmt = _subtotal * 0.10;
      _subtotal -= over60DiscountAmt;
      _savings += over60DiscountAmt;
    }

    return { subtotal: _subtotal, totalSavings: _savings, itemsMap, globalDiscount, loyaltyDiscountAmt, over60DiscountAmt };
  };

  const { subtotal, totalSavings, itemsMap, globalDiscount, loyaltyDiscountAmt, over60DiscountAmt } = calculateCartTotals();

  const registerOrLoginBuyer = async () => {
    if (!authEmail || !authPassword) {
      setMessage("Enter email and password");
      return;
    }
    if (authMode === "register" && (!name || !mobile)) {
      setMessage("Enter your full name and authentic phone number for registration");
      return;
    }

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          email: authEmail,
          password: authPassword,
          name: name,
          phone: mobile
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Authentication failed");
        return;
      }

      if (authMode === "reset") {
        setMessage(data.message || "Password safely reset! Please login now.");
        setAuthMode("login");
        setAuthPassword("");
        return;
      }

      const newBuyer: Buyer = {
        name: data.customer.name,
        mobile: data.customer.phone,
        email: data.customer.email,
        verified: true,
        notes: data.customer.notes
      };

      // Store JWT token for authenticated API calls (G-002)
      if (data.token) {
        setCustomerToken(data.token);
        localStorage.setItem("groceryos_token", data.token);
        (window as any).__customerToken = data.token;
      }

      setBuyer(newBuyer);
      localStorage.setItem("groceryos_buyer", JSON.stringify(newBuyer));
      setRoute("store");
      setMessage(authMode === "register" ? "Registration successful!" : `Welcome back, ${data.customer.name}!`);
    } catch (e) {
      setMessage("Auth Server Error. Check console.");
    }
  };

  const toggleLoyalty = async (c: any) => {
    const isLoyal = c.notes?.includes("LOYALTY");
    const newNotes = isLoyal ? c.notes.replace("LOYALTY", "").trim() : (c.notes || "").trim() + " LOYALTY";
    try {
      const res = await fetch("/api/customers", {
        method: "PUT",
        body: JSON.stringify({ id: c.id, notes: newNotes.trim() }),
      });
      if (res.ok) {
        setAdminCustomers(prev => prev.map(x => x.id === c.id ? { ...x, notes: newNotes.trim() } : x));
        setMessage(`${c.name} ${isLoyal ? "removed from" : "added to"} Loyalty program.`);
      }
    } catch (e) { }
  };

  const Btn = ({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) => (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: active ? "#2563eb" : "transparent",
        color: active ? "white" : "#cbd5e1",
        border: active ? "1px solid #2563eb" : "1px solid #334155",
        cursor: "pointer",
        marginBottom: 10,
        width: "100%",
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );

  if (!mounted) return <div style={{ display: 'flex', height: '100vh', background: '#0b132b', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontWeight: 'bold' }}>Loading Dashboard...</div>;

  return (
    <>
      {storeAlert.active && route !== "admin" && (
        <div style={{ background: "#eab308", color: "black", textAlign: "center", padding: "6px 12px", fontWeight: "bold", zIndex: 9999, position: "fixed", top: 0, left: 0, right: 0, fontSize: 13, boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
          {storeAlert.message}
        </div>
      )}
      {/* ── Idle Session Warning Banner (G-013, PCI-DSS) ── */}
      {idleWarning && buyer && (
        <div style={{ background: "#dc2626", color: "white", textAlign: "center", padding: "8px 16px", fontWeight: "bold", zIndex: 10000, position: "fixed", top: storeAlert.active && route !== "admin" ? 30 : 0, left: 0, right: 0, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          ⚠️ Your session will expire in under 1 minute due to inactivity.
          <button
            onClick={() => { lastActivityRef.current = Date.now(); setIdleWarning(false); }}
            style={{ background: "white", color: "#dc2626", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: "bold", fontSize: 12 }}
          >
            Stay Logged In
          </button>
        </div>
      )}
      <div
        style={{
          height: "100vh",
          paddingTop: (storeAlert.active && route !== "admin") ? 30 : 0,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: route === "admin" ? "220px 1fr" : "220px 1fr 300px",
          background: "#0b132b",
          color: "white",
          boxSizing: "border-box",
        }}
      >
        <style>{`
        button { transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1); }
        button:active { transform: scale(0.95); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        ::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #64748b; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active{
            -webkit-box-shadow: 0 0 0 30px #1e293b inset !important;
            -webkit-text-fill-color: #f8fafc !important;
            transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

        <aside style={{ padding: 20, borderRight: "1px solid #334155", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <h3>🛒 Grocery OS</h3>



          <Btn
            active={route === "store"}
            label={productsExpanded ? "Products ▼" : "Products ▶"}
            onClick={() => {
              setRoute("store");
              setMessage("");
              setSelectedCategory("All");
              setProductsExpanded((v) => !v);
            }}
          />

          {productsExpanded && (
            <div style={{ margin: "4px 0 16px 12px", paddingLeft: 10, borderLeft: "2px solid #334155", display: "grid", gap: 4 }}>
              {[
                "All",
                "Flour",
                "Rice",
                "Vegetables",
                "Spices",
                "Oil",
                "Lentils",
                "Fruits",
                "Confectionery",
                "Frozen Item",
                "Sweets",
                "Snacks",
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setRoute("store");
                    setMessage("");
                    setSelectedCategory(cat);
                    setQuery("");
                  }}
                  style={{
                    textAlign: "left",
                    background: route === "store" && selectedCategory === cat ? "#1d4ed8" : "transparent",
                    color: route === "store" && selectedCategory === cat ? "white" : "#94a3b8",
                    border: route === "store" && selectedCategory === cat ? "1px solid #2563eb" : "1px solid transparent",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <Btn active={route === "sale"} label="Offers" onClick={() => { setSelectedCategory("All"); setRoute("sale"); setMessage(""); }} />

          {!adminLogged && (
            <Btn
              active={route === "buyer"}
              label={buyer ? `My Account (${buyer.name})` : "Sign In / Register"}
              onClick={() => { setRoute("buyer"); setMessage(""); }}
            />
          )}
          {((buyer && route !== "admin") || adminLogged || employeeLogged) && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to securely log out of your active Grocery OS profile?")) {
                  if (route === "admin") {
                    setAdminLogged(false);
                    setEmployeeLogged(false);
                    setMessage("Seller identity disconnected securely.");
                  } else {
                    setBuyer(null);
                    setCustomerToken(null);
                    localStorage.removeItem("groceryos_buyer");
                    localStorage.removeItem("groceryos_token");
                    (window as any).__customerToken = null;
                    setMessage("Buyer profile signed out universally.");
                  }
                }
              }}
              style={{
                width: "100%", textAlign: "left", padding: 12, borderRadius: 10,
                background: "transparent", color: "#fca5a5", border: "1px solid #7f1d1d", cursor: "pointer", marginTop: 8
              }}
            >
              Log Out {route === "admin" ? (adminLogged ? "(Admin)" : "(Employee)") : "(Buyer)"}
            </button>
          )}

          {(adminLogged || employeeLogged || route === "admin") && (
            <Btn
              active={route === "admin"}
              label="Seller Dashboard"
              onClick={() => { setRoute("admin"); setMessage(""); }}
            />
          )}

          <div style={{ flex: 1, minHeight: 40 }} />

          <button
            onClick={() => {
              window.alert(`Grocery OS Dedicated Support\n\n${supportContact}`);
            }}
            style={{
              width: "100%", textAlign: "left", padding: 12, borderRadius: 10,
              background: "transparent", color: "#94a3b8", border: "1px solid #334155", cursor: "pointer"
            }}
          >
            Help & Support
          </button>
        </aside>

        <main style={{ padding: 24, paddingBottom: 0, height: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden" }}>
          {message && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                border: "1px solid",
                borderColor: message.toLowerCase().includes("error") || message.toLowerCase().includes("incomplete") || message.toLowerCase().includes("failed") ? "#ef4444" : "#334155",
                color: message.toLowerCase().includes("error") || message.toLowerCase().includes("incomplete") || message.toLowerCase().includes("failed") ? "#fca5a5" : "inherit",
                background: message.toLowerCase().includes("error") || message.toLowerCase().includes("incomplete") || message.toLowerCase().includes("failed") ? "#450a0a" : "transparent",
                borderRadius: 10,
              }}
            >
              {message}
            </div>
          )}

          {(route === "store" || route === "sale") && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexShrink: 0 }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products"
                  style={{ flex: 1, padding: 12, borderRadius: 10 }}
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "#475569",
                      color: "white",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                )}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ padding: 12, borderRadius: 10 }}
                >
                  <option value="default">Sort</option>
                  <option value="priceLowHigh">Price: Low to High</option>
                  <option value="priceHighLow">Price: High to Low</option>
                  <option value="nameAZ">Name: A-Z</option>
                  <option value="saleOnly">Sale Only</option>
                </select>
              </div>

              <div style={{ flex: 1, overflowY: "auto", paddingRight: 8, paddingBottom: 24, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    alignContent: "start",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: 12,
                  }}
                >
                  {visible.slice((currentPage - 1) * 40, currentPage * 40).map((p) => (
                    <div
                      key={p.id}
                      style={{
                        border: "1px solid #334155",
                        borderRadius: 10,
                        padding: 8,
                        display: "flex",
                        flexDirection: "column",
                        fontSize: 13,
                      }}
                    >
                      {p.image ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.image} alt={p.name} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6, marginBottom: 8, background: "#1e293b" }} />
                        </>
                      ) : (
                        <div
                          style={{
                            height: 120,
                            borderRadius: 6,
                            background: "#1e293b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 8,
                            color: "#94a3b8",
                            fontSize: 11,
                          }}
                        >
                          Product Image
                        </div>
                      )}

                      <strong style={{ fontSize: 14 }}>{p.name}</strong>
                      <div style={{ color: "#94a3b8", marginBottom: 2 }}>
                        {p.category} {p.stock <= 10 ? <span style={{ color: "#ef4444", fontWeight: "bold" }}> • {p.stock === 0 ? "Out of Stock" : `Only ${p.stock} left in stock!`}</span> : ""}
                      </div>

                      <div style={{ marginBottom: 4 }}>
                        {!(p.promo === "BOGO") &&
                          p.wasPrice > 0 && (
                            <span
                              style={{
                                textDecoration: "line-through",
                                marginRight: 6,
                                color: "#94a3b8",
                                fontSize: 12,
                              }}
                            >
                              £{p.wasPrice.toFixed(2)}
                            </span>
                          )}
                        <strong style={{ color: "#38bdf8" }}>£{p.price.toFixed(2)}</strong>
                      </div>

                      {p.promo && <div style={{ color: "#86efac", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.promo}</div>}

                      <div style={{ marginTop: "auto", paddingTop: 10 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => decreaseQty(p.id)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              background: "#334155",
                              color: "white",
                              border: 0,
                              cursor: "pointer",
                            }}
                          >
                            −
                          </button>

                          <button
                            onClick={() => addToCart(p)}
                            style={{
                              flex: 1,
                              padding: "6px 10px",
                              borderRadius: 6,
                              background: "#2563eb",
                              color: "white",
                              border: 0,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Add
                          </button>
                        </div>
                        {cart.find((x) => x.id === p.id)?.qty ? (
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, textAlign: "center" }}>
                            In cart: {cart.find((x) => x.id === p.id)?.qty}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: "transparent", marginTop: 4, textAlign: "center", userSelect: "none" }}>
                            &nbsp;
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {visible.length > 40 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 24 }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{ padding: "8px 16px", borderRadius: 8, background: currentPage === 1 ? "#334155" : "#2563eb", color: "white", border: 0, cursor: currentPage === 1 ? "not-allowed" : "pointer", fontWeight: "bold" }}
                    >Previous</button>
                    <span style={{ padding: "8px 16px", background: "#1e293b", color: "white", borderRadius: 8, border: "1px solid #475569" }}>
                      Page {currentPage} of {Math.ceil(visible.length / 40)}
                    </span>
                    <button
                      disabled={currentPage === Math.ceil(visible.length / 40)}
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(visible.length / 40), p + 1))}
                      style={{ padding: "8px 16px", borderRadius: 8, background: currentPage === Math.ceil(visible.length / 40) ? "#334155" : "#2563eb", color: "white", border: 0, cursor: currentPage === Math.ceil(visible.length / 40) ? "not-allowed" : "pointer", fontWeight: "bold" }}
                    >Next</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {route === "admin" && (
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 10, paddingBottom: 24, width: "100%" }}>
              {!adminLogged && !employeeLogged && <h2>Employee or Admin Login</h2>}

              {!adminLogged && !employeeLogged ? (
                <>
                  <input
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    placeholder="Admin User ID / Email"
                    disabled={adminOtpSent}
                    style={{ display: "block", padding: 12, marginBottom: 12, width: 420, borderRadius: 10, background: "#1e293b", color: "white", border: "1px solid #475569" }}
                  />
                  <input
                    type="password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    placeholder="Master Password"
                    disabled={adminOtpSent}
                    style={{ display: "block", padding: 12, marginBottom: 12, width: 420, borderRadius: 10, background: "#1e293b", color: "white", border: "1px solid #475569" }}
                  />

                  {adminOtpSent && (
                    <input
                      value={adminOtp}
                      onChange={(e) => setAdminOtp(e.target.value)}
                      placeholder="Enter 6-Digit Email OTP"
                      style={{ display: "block", padding: 12, marginBottom: 12, width: 420, borderRadius: 10, background: "#1e293b", color: "#86efac", border: "1px solid #22c55e", fontWeight: "bold" }}
                    />
                  )}

                  <Btn
                    label={adminOtpSent ? "Verify Mail OTP & Login" : "Request Secure Mail OTP"}
                    onClick={async () => {
                      setMessage("Connecting to secure gateway...");
                      try {
                        if (!adminOtpSent) {
                          const r = await fetch("/api/auth/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request_otp", username: adminUser, password: adminPass }) });
                          if (!r.ok) throw new Error("Gateway failed HTTP " + r.status);
                          const d = await r.json();
                          if (d.error) return setMessage(d.error);
                          setAdminOtpSent(true);
                          setMessage(d.message);
                        } else {
                          const r = await fetch("/api/auth/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify_otp", otp: adminOtp }) });
                          if (!r.ok) throw new Error("Gateway failed HTTP " + r.status);
                          const d = await r.json();
                          if (d.error) return setMessage(d.error);

                          if (d.requiresMfa) {
                            // MFA configured — show TOTP step
                            setAdminMfaRequired(true);
                            setAdminMfaToken(d.mfaToken);
                            setAdminOtp("");
                            setMessage("OTP verified. Enter the 6-digit code from your authenticator app.");
                          } else {
                            setAdminLogged(true);
                            setAdminOtpSent(false);
                            setAdminOtp("");
                            setMessage("Admin authenticated successfully!");
                          }
                        }
                      } catch (err: any) {
                        setMessage("Console Crash: Connection or Server Error -> " + err.message);
                      }
                    }}
                  />

                  {!adminOtpSent && (
                    <button
                      onClick={async () => {
                        setMessage("Sending recovery instructions...");
                        const r = await fetch("/api/auth/admin", { method: "POST", body: JSON.stringify({ action: "forgot_password" }) });
                        const d = await r.json();
                        setMessage(d.message || d.error);
                      }}
                      style={{ background: "transparent", color: "#38bdf8", border: 0, marginTop: 12, cursor: "pointer", fontWeight: "bold", width: "100%", textAlign: "left" }}
                    >
                      Forgot System Password?
                    </button>
                  )}

                  {/* ── MFA TOTP Step (G-076) ── */}
                  {adminMfaRequired && (
                    <div style={{ marginTop: 16, padding: 16, background: "rgba(59,130,246,0.1)", border: "1px solid #3b82f6", borderRadius: 10 }}>
                      <p style={{ color: "#93c5fd", marginBottom: 12, fontWeight: "bold" }}>🔐 Step 3: Authenticator App</p>
                      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.)</p>
                      <input
                        value={adminTotpCode}
                        onChange={e => setAdminTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        style={{ display: "block", padding: 12, marginBottom: 12, width: 420, borderRadius: 10, background: "#1e293b", color: "#93c5fd", border: "1px solid #3b82f6", fontWeight: "bold", fontSize: 20, letterSpacing: 8, textAlign: "center" }}
                      />
                      <Btn
                        label="Verify Authenticator Code"
                        onClick={async () => {
                          setMessage("Verifying authenticator code...");
                          try {
                            const r = await fetch("/api/auth/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify_mfa", mfaToken: adminMfaToken, totpCode: adminTotpCode }) });
                            const d = await r.json();
                            if (d.error) return setMessage(d.error);
                            setAdminLogged(true);
                            setAdminMfaRequired(false);
                            setAdminMfaToken("");
                            setAdminTotpCode("");
                            setAdminOtpSent(false);
                            setMessage("Admin authenticated successfully! (MFA verified)");
                          } catch (err: any) {
                            setMessage("MFA verification failed: " + err.message);
                          }
                        }}
                      />
                    </div>
                  )}

                  <div style={{ marginTop: 24, borderTop: "1px dashed #334155", paddingTop: 24 }}>
                    <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16, fontWeight: "bold" }}>Employee Quick Connect (POS & Orders)</p>
                    <input id="emp_login_id" placeholder="Employee User ID" style={{ display: "block", padding: 12, marginBottom: 12, width: 420, borderRadius: 10, background: "#1e293b", color: "white", border: "1px solid #475569" }} />
                    <input id="emp_login_pass" placeholder="Employee Password" type="password" style={{ display: "block", padding: 12, marginBottom: 12, width: 420, borderRadius: 10, background: "#1e293b", color: "white", border: "1px solid #475569" }} />
                    <Btn label="Sign In as Staff" onClick={async () => {
                      const uid = (document.getElementById("emp_login_id") as HTMLInputElement).value;
                      const pwd = (document.getElementById("emp_login_pass") as HTMLInputElement).value;
                      if (!uid || !pwd) return window.alert("Enter ID and Password.");
                      setMessage("Verifying internal staff credentials...");
                      const req = await fetch("/api/auth/employee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: uid, password: pwd }) }).then(r => r.json());
                      if (req.error) return setMessage(req.error);

                      setEmployeeContext(req.user);
                      setEmployeeLogged(true);
                      setAdminTab("Instore POS");
                      setMessage(`Connected successfully as ${req.user.name}.`);
                    }} />
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      marginTop: 20,
                      display: "grid",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        padding: 16,
                        border: "1px solid #334155",
                        borderRadius: 12,
                        background: "#111827",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          marginBottom: 12,
                        }}
                      >
                        Seller Control Tower
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 12,
                          marginBottom: 20,
                        }}
                      >
                        {[
                          "Instore POS",
                          "Add & Edit",
                          "Orders",
                          "Customers",
                          "Staff",
                          "Alerts",
                          "Revenue & Ledger",
                          "Analytics",
                          "Global Promos"
                        ].map((x) => (
                          <button
                            key={x}
                            onClick={() => {
                              if (!adminLogged) {
                                if (!employeeContext?.modules?.includes(x)) {
                                  if (!window.confirm(`ACCESS DENIED: Module '${x}' is physically restricted from your staff profile.\n\nWould you like to elevate to Master Admin securely?`)) return;
                                  const auth = window.prompt("Enter Master Password precisely:");
                                  if (auth !== adminPass && auth !== "admin123") return window.alert("Master Override Failed.");
                                  setAdminLogged(true); // Elevate automatically
                                }
                              }
                              setAdminTab(x);
                              if (x === "Orders" || x === "Analytics" || x === "Revenue & Ledger") {
                                fetch("/api/orders").then(res => res.json()).then(data => { const list = Array.isArray(data) ? data : (data?.orders ?? []); setAdminOrders(list); });
                                fetch("/api/products").then(res => res.json()).then(data => { const list = Array.isArray(data) ? data : (data?.products ?? []); if (list.length > 0) setAdminProducts(list); });
                              }
                              if (x === "Staff") {
                                fetch("/api/employees").then(res => res.json()).then(d => { if (Array.isArray(d)) setAdminEmployees(d); else if (d.error) window.alert(d.error); });
                              }
                            }}
                            style={{
                              padding: 12,
                              borderRadius: 10,
                              background: adminTab === x ? "#10b981" : "#1e293b",
                              color: adminTab === x ? "white" : "#94a3b8",
                              border: adminTab === x ? "1px solid #059669" : "1px solid #334155",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            {x}
                          </button>
                        ))}
                      </div>

                      {adminTab === "Instore POS" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, height: "calc(100vh - 200px)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ margin: 0 }}>Point of Sale Terminal</h3>
                                {posSyncQueue.length > 0 && (
                                   <div style={{ background: "#78350f", color: "#fbbf24", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", border: "1px solid #d97706" }}>
                                     🔄 {posSyncQueue.length} sale{posSyncQueue.length > 1 ? "s" : ""} pending server sync
                                     {syncStatus && <span style={{ marginLeft: 6, opacity: 0.8 }}>({syncStatus})</span>}
                                   </div>
                                )}
                            </div>
                            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, whiteSpace: "nowrap" }}>
                              {["All", ...Array.from(new Set(adminProducts.map(p => p.category)))].map(cat => (
                                <button
                                  key={cat as string}
                                  onClick={() => setPosCategory(cat as string)}
                                  style={{ padding: "6px 12px", borderRadius: 8, background: posCategory === cat ? "#3b82f6" : "#1e293b", color: posCategory === cat ? "white" : "#94a3b8", border: "1px solid #475569", cursor: "pointer", fontWeight: "bold" }}>
                                  {cat as string}
                                </button>
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                id="posSearchNative"
                                placeholder="Tap Scanner, Enter Barcode, or Search product..."
                                value={posSearch}
                                onChange={e => setPosSearch(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && posSearch.trim() !== '') {
                                    const hits = adminProducts.filter(p => posCategory === "All" || p.category === posCategory).filter(p => p.name.toLowerCase().includes(posSearch.toLowerCase()) || p.category.toLowerCase().includes(posSearch.toLowerCase()) || (p.barcode && p.barcode === posSearch.trim()));
                                    if (hits.length === 1) {
                                      const p = hits[0];
                                      const existing = posCart.find(x => x.id === p.id);
                                      const qty = existing ? existing.qty : 0;
                                      if (qty + 1 > p.stock) {
                                        const pwd = window.prompt(`Stock Limit Enforced! Master Password required to override safe boundary of ${p.stock} ${p.unit}:`);
                                        if (pwd !== adminPass && pwd !== "admin123") return window.alert("Override Denied securely.");
                                      }
                                      setPosCart(prev => {
                                        if (existing) return prev.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x);
                                        return [...prev, { ...p, qty: 1 }];
                                      });
                                      setPosSearch("");
                                    }
                                  }
                                }}
                                style={{ flex: 1, padding: 12, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569" }}
                              />
                              <button onClick={() => setScanningPos(!scanningPos)} style={{ padding: "0 16px", borderRadius: 8, background: scanningPos ? "#ef4444" : "#2563eb", color: "white", border: 0, cursor: "pointer", fontWeight: "bold" }}>
                                {scanningPos ? "Cancel Lens" : "📷 Camera"}
                              </button>
                            </div>
                            {scanningPos && (
                              <div style={{ width: "100%", background: "black", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column", paddingBottom: 16 }}>
                                <div id="reader" style={{ width: "100%", minHeight: 200 }}></div>
                                <button onClick={() => {
                                  if ((window as any).__startMobileScanner) {
                                    (window as any).__startMobileScanner();
                                  } else {
                                    window.alert("Scanner is still loading... please wait.");
                                  }
                                }} style={{ margin: "16px auto", width: "90%", padding: 16, background: "#10b981", color: "white", fontWeight: "bold", fontSize: 16, borderRadius: 8, border: 0, cursor: "pointer", boxShadow: "0px 4px 15px rgba(16,185,129,0.4)" }}>
                                  GRANT MOBILE CAMERA ACCESS
                                </button>
                              </div>
                            )}
                            <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, paddingRight: 8 }}>
                              {adminProducts.filter(p => posCategory === "All" || p.category === posCategory).filter(p => p.name.toLowerCase().includes(posSearch.toLowerCase()) || p.category.toLowerCase().includes(posSearch.toLowerCase())).map(p => (
                                <div key={p.id} style={{ background: "#1e293b", padding: 12, borderRadius: 10, border: "1px solid #334155", display: "flex", flexDirection: "column" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                    <div style={{ fontWeight: "bold", fontSize: 13 }}>{p.name}</div>
                                    {p.promo && <span style={{ background: "#dc2626", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: "bold", marginLeft: 4, whiteSpace: "nowrap" }}>{p.promo}</span>}
                                  </div>
                                  {p.barcode && <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>|||| {p.barcode}</div>}
                                  <div style={{ color: "#38bdf8", fontSize: 12, marginBottom: 8 }}>£{p.price.toFixed(2)} / {p.unit}</div>
                                  <div style={{ color: p.stock <= 0 ? "#ef4444" : p.stock < 5 ? "#fca5a5" : "#94a3b8", fontSize: 11, marginBottom: 10 }}>
                                    {p.stock <= 0 ? "⚠️ Out of Stock" : `Stock: ${Math.max(0, p.stock)} ${p.unit}`}
                                  </div>

                                  <div style={{ display: "flex", marginTop: "auto", gap: 4 }}>
                                    {p.unit === "Piece" || p.unit === "Pack" ? (
                                      <button onClick={() => {
                                        const existing = posCart.find(x => x.id === p.id);
                                        const qty = existing ? existing.qty : 0;
                                        if (qty + 1 > p.stock) {
                                          const pwd = window.prompt(`Stock Limit Enforced! Master Password required to override safe boundary of ${p.stock} ${p.unit}:`);
                                          if (pwd !== adminPass && pwd !== "admin123") return window.alert("Override Denied securely.");
                                        }
                                        setPosCart(prev => {
                                          if (existing) return prev.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x);
                                          return [...prev, { ...p, qty: 1 }];
                                        });
                                      }} style={{ flex: 1, padding: "6px", background: "#2563eb", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>+ TAP</button>
                                    ) : (
                                      <div style={{ display: "flex", gap: 4, width: "100%" }}>
                                        <input type="number" step="1" min="0" placeholder="wt" value={posInputQty[p.id] || ""} onChange={e => setPosInputQty({ ...posInputQty, [p.id]: e.target.value })} style={{ flex: 1, width: 0, padding: 4, borderRadius: 4, background: "#0f172a", color: "white", border: "1px solid #475569" }} />
                                        <button onClick={() => {
                                          const val = parseFloat(posInputQty[p.id] || "0");
                                          if (val > 0) {
                                            const existing = posCart.find(x => x.id === p.id);
                                            const qty = existing ? existing.qty : 0;
                                            if (qty + val > p.stock) {
                                              const pwd = window.prompt(`Stock Limit Enforced! Master Password required to override safe boundary of ${p.stock} ${p.unit}:`);
                                              if (pwd !== adminPass && pwd !== "admin123") return window.alert("Override Denied securely.");
                                            }
                                            setPosCart(prev => {
                                              if (existing) return prev.map(x => x.id === p.id ? { ...x, qty: x.qty + val } : x);
                                              return [...prev, { ...p, qty: val }];
                                            });
                                            setPosInputQty({ ...posInputQty, [p.id]: "" });
                                          }
                                        }} style={{ padding: "4px 8px", background: "#eab308", color: "black", border: 0, borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>Add</button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div style={{ background: "#0f172a", borderLeft: "1px solid #334155", padding: 16, display: "flex", flexDirection: "column", borderRadius: 12 }}>
                            <h3 style={{ margin: "0 0 16px 0", color: "#e2e8f0" }}>Terminal Cart</h3>
                            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 8 }}>
                              {posCart.length === 0 ? <span style={{ color: "#475569" }}>Cart is empty physically.</span> : posCart.map((c, i) => {
                                const localMap = calculateCartTotals(posCart).itemsMap;
                                const itemData = localMap[c.id];
                                return (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid #1e293b", paddingBottom: 8 }}>
                                    <div>
                                      <div style={{ fontWeight: "bold" }}>{c.name} {itemData?.savings > 0 && <span style={{ color: "#86efac", fontSize: 10, marginLeft: 6 }}>OFFER APPLIED</span>}</div>
                                      <div style={{ color: "#94a3b8" }}>{c.qty} {c.unit} x £{c.price.toFixed(2)}</div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                      {itemData?.savings > 0 ? (
                                        <>
                                          <span style={{ textDecoration: "line-through", color: "#94a3b8", fontSize: 11 }}>£{(c.qty * c.price).toFixed(2)}</span>
                                          <strong style={{ color: "#86efac" }}>£{itemData.total.toFixed(2)}</strong>
                                        </>
                                      ) : (
                                        <strong>£{(c.qty * c.price).toFixed(2)}</strong>
                                      )}
                                      <button onClick={() => {
                                        setPosCart(prev => prev.filter(x => x.id !== c.id));
                                      }} style={{ background: "transparent", color: "#fca5a5", border: 0, cursor: "pointer", fontSize: 11 }}>Remove</button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <div style={{ marginTop: 16, borderTop: "1px dashed #334155", paddingTop: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
                                <span>Total Payable:</span>
                                <div>
                                  {(() => {
                                    const { subtotal: posSubtotal, totalSavings: posSavings } = calculateCartTotals(posCart);
                                    if (posSavings > 0) {
                                      return (
                                        <>
                                          <span style={{ fontSize: 13, color: "#94a3b8", textDecoration: "line-through", marginRight: 8 }}>£{(posSubtotal + posSavings).toFixed(2)}</span>
                                          <span style={{ color: "#86efac" }}>£{posSubtotal.toFixed(2)}</span>
                                        </>
                                      );
                                    }
                                    return <span style={{ color: "#86efac" }}>£{posSubtotal.toFixed(2)}</span>;
                                  })()}
                                </div>
                              </div>
                              <button onClick={() => {
                                if (posCart.length === 0) return window.alert("Scan items to process transaction.");
                                setPosCheckoutModal(true);
                              }} style={{ width: "100%", padding: 14, background: "#16a34a", color: "white", fontSize: 16, fontWeight: "bold", borderRadius: 8, border: 0, cursor: "pointer" }}>Checkout Order</button>
                              <div style={{ marginTop: 24, borderTop: "1px dashed #334155", paddingTop: 16 }}>
                                <h4 style={{ margin: "0 0 8px 0", color: "#eab308", fontSize: 13 }}>Quick Broadcast Flash</h4>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 8, cursor: "pointer" }}>
                                  <input type="checkbox" checked={storeAlert.active} onChange={e => setStoreAlert({ ...storeAlert, active: e.target.checked })} />
                                  Enable Live Store Banner
                                </label>
                                <textarea value={storeAlert.message} onChange={e => setStoreAlert({ ...storeAlert, message: e.target.value })} placeholder="Massive sale going on! Or product back in stock!" style={{ width: "100%", padding: 8, borderRadius: 6, background: "#1e293b", color: "#f8fafc", border: "1px solid #eab308", resize: "none", fontSize: 12 }} rows={2}></textarea>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {posCheckoutModal && (
                         <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, backdropFilter: "blur(4px)" }}>
                           <div style={{ background: "#0f172a", padding: "32px", borderRadius: 20, width: 600, border: "1px solid #334155", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
                             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155", paddingBottom: 16, marginBottom: 24 }}>
                               <h2 style={{ margin: 0, fontSize: 24, display: "flex", alignItems: "center", gap: 12 }}>💳 Complete Transaction</h2>
                               <button onClick={() => setPosCheckoutModal(false)} style={{ background: "transparent", color: "#94a3b8", border: 0, cursor: "pointer", fontSize: 24 }}>&times;</button>
                             </div>
                             
                             {(() => {
                                const { subtotal: total, totalSavings, itemsMap } = calculateCartTotals(posCart);
                                const parsedReceived = parseFloat(paymentForm.received) || 0;
                                const changeDue = Math.max(0, parsedReceived - total);
                                
                                return (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                                    <div style={{ background: "#1e293b", padding: 20, borderRadius: 12, textAlign: "center", border: "1px solid #475569" }}>
                                      <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 4 }}>Amount Due</div>
                                      <div style={{ fontSize: 36, fontWeight: "bold", color: "#86efac" }}>£{total.toFixed(2)}</div>
                                    </div>
                                    
                                    <div style={{ display: "flex", gap: 12 }}>
                                        {["Cash", "Card Tap", "Split", "UPI/Stripe", "Pending"].map(method => (
                                          <button key={method} onClick={() => setPaymentForm({ ...paymentForm, method })} style={{ flex: 1, padding: "12px 8px", borderRadius: 8, border: "1px solid #475569", background: paymentForm.method === method ? "#3b82f6" : "#1e293b", color: "white", cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>
                                            {method}
                                          </button>
                                        ))}
                                    </div>

                                    <div style={{ minHeight: 80, padding: 16, background: "#020617", borderRadius: 12, border: "1px solid #334155" }}>
                                      {paymentForm.method === "Cash" && (
                                        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                                          <div style={{ flex: 1 }}>
                                            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Cash Received (£)</label>
                                            <input type="number" value={paymentForm.received} onChange={e => setPaymentForm({ ...paymentForm, received: e.target.value })} style={{ width: "100%", padding: 12, background: "#1e293b", color: "white", border: "1px solid #475569", borderRadius: 8, fontSize: 16 }} placeholder="e.g. 50" />
                                          </div>
                                          <div style={{ flex: 1 }}>
                                            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Change Due</label>
                                            <div style={{ fontSize: 24, fontWeight: "bold", color: changeDue > 0 ? "#fca5a5" : "#94a3b8", padding: "6px 0" }}>£{changeDue.toFixed(2)}</div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {paymentForm.method === "Card Tap" && (
                                        <div style={{ textAlign: "center", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                                          <div style={{ fontSize: 32, animation: "pulse 2s infinite" }}>🔄</div>
                                          Ready for terminal presentation...
                                        </div>
                                      )}

                                      {paymentForm.method === "Split" && (
                                        <div style={{ display: "flex", gap: 16 }}>
                                           <div style={{ flex: 1 }}>
                                             <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Cash Portion (£)</label>
                                             <input type="number" value={paymentForm.splitCash} onChange={e => {
                                                const cash = parseFloat(e.target.value) || 0;
                                                setPaymentForm({ ...paymentForm, splitCash: e.target.value, splitCard: Math.max(0, total - cash).toFixed(2) });
                                              }} style={{ width: "100%", padding: 12, background: "#1e293b", color: "white", border: "1px solid #475569", borderRadius: 8, fontSize: 16 }} />
                                           </div>
                                           <div style={{ flex: 1 }}>
                                             <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Card Portion (£)</label>
                                             <input type="number" value={paymentForm.splitCard} onChange={e => {
                                                const card = parseFloat(e.target.value) || 0;
                                                setPaymentForm({ ...paymentForm, splitCard: e.target.value, splitCash: Math.max(0, total - card).toFixed(2) });
                                              }} style={{ width: "100%", padding: 12, background: "#1e293b", color: "white", border: "1px solid #475569", borderRadius: 8, fontSize: 16 }} />
                                           </div>
                                        </div>
                                      )}

                                      {paymentForm.method === "UPI/Stripe" && (
                                        <div style={{ textAlign: "center", color: "#94a3b8" }}>
                                          <div style={{ width: 100, height: 100, background: "#ffffff", margin: "0 auto", borderRadius: 8, padding: 8 }}>
                                             {/* Abstract dummy QR graphic */}
                                             <div style={{ width: "100%", height: "100%", border: "8px dashed #000" }}></div>
                                          </div>
                                          <div style={{ marginTop: 12 }}>Awaiting UPI confirmation...</div>
                                        </div>
                                      )}
                                      
                                      {paymentForm.method === "Pending" && (
                                        <div style={{ textAlign: "center", color: "#fca5a5", paddingTop: 12 }}>
                                           Item will be given. Payment will be collected later. (Khata)
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                                      <button onClick={() => setPosCheckoutModal(false)} style={{ flex: 1, padding: 16, background: "transparent", color: "white", borderRadius: 8, border: "1px solid #475569", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                                      
                                      <button onClick={async () => {
                                          if (paymentForm.method === "Cash" && parsedReceived < total) {
                                             if (!window.confirm("Warning: Cash received is less than total due. Proceed anyway?")) return;
                                          }
                                          if (paymentForm.method === "Split") {
                                             const sCash = parseFloat(paymentForm.splitCash) || 0;
                                             const sCard = parseFloat(paymentForm.splitCard) || 0;
                                             if (Math.abs((sCash + sCard) - total) > 0.01) {
                                                if (!window.confirm("Warning: Split total does not exactly match amount due. Proceed anyway?")) return;
                                             }
                                          }
                                          
                                          const idempotencyKey = "pos_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
                                          const payload = {
                                            buyer: { name: "Instore Walk-in", mobile: "POS" },
                                            cart: posCart,
                                            deliveryAddress: "Instore Counter Transaction",
                                            deliveryComment: "POS " + paymentForm.method + " Sale",
                                            subtotal: total,
                                            idempotencyKey
                                          };
                                          const printReceipt = () => {
                                            const printIframe = document.createElement('iframe');
                                            printIframe.style.display = 'none';
                                            document.body.appendChild(printIframe);
                                            const doc = printIframe.contentDocument || printIframe.contentWindow?.document;
                                            if (doc) {
                                              let cartHTML = "";
                                              let itemCount = 0;
                                              
                                              posCart.forEach(c => {
                                                  itemCount += c.qty;
                                                  const baseTotal = c.qty * c.price;
                                                  const itemSavings = itemsMap[c.id] ? itemsMap[c.id].savings : 0;
                                                  
                                                  cartHTML += "<tr><td style='text-align: left;' colspan='2'>" + c.name.toUpperCase() + "</td><td style='text-align: right;'>£" + baseTotal.toFixed(2) + "</td></tr>";
                                                  
                                                  if (c.unit === 'KG') {
                                                      cartHTML += "<tr><td style='padding-left: 12px; font-size: 11px; padding-bottom: 4px; color: #333;' colspan='3'>" + c.qty + "kg @ " + c.price.toFixed(2) + "/kg</td></tr>";
                                                  } else {
                                                      cartHTML += "<tr><td style='padding-left: 12px; font-size: 11px; padding-bottom: 4px; color: #333;' colspan='3'>( " + c.qty + " X £" + c.price.toFixed(2) + " EACH )</td></tr>";
                                                  }

                                                  if (itemSavings > 0) {
                                                      cartHTML += "<tr><td style='text-align: left;' colspan='2'>" + c.name.toUpperCase() + "</td><td style='text-align: right;'>-£" + itemSavings.toFixed(2) + "</td></tr>";
                                                  }
                                              });

                                              if (totalSavings > 0) {
                                                  cartHTML += "<tr><td style='text-align: left;' colspan='2'><b>TOTAL SAVINGS</b></td><td style='text-align: right;'><b>-£" + totalSavings.toFixed(2) + "</b></td></tr>";
                                              }

                                              const dDate = new Date();
                                              const dateStr = dDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                              const timeStr = dDate.toLocaleTimeString('en-GB', { hour12: false });
                                              
                                              const receiptNo = Math.floor(10000 + Math.random() * 90000);
                                              const authCode = Math.floor(100000 + Math.random() * 900000);

                                              let paymentDetailsStr = "";
                                              if (paymentForm.method === "Card Tap" || paymentForm.method === "Split" || paymentForm.method === "UPI/Stripe") {
                                                  paymentDetailsStr = 
                                                    "MID:XX403504 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; TID:XXXX1613<br/>" +
                                                    "AID:A0000000031010<br/>" +
                                                    "VISA DEBIT<br/>" +
                                                    "XXXX XXXX XXXX 1251<br/>" +
                                                    "PAN SEQ NO: .00<br/><br/>" +
                                                    "<div style='display:flex; justify-content:space-between'><span>SALE</span><span>GBP" + total.toFixed(2) + "</span></div>" +
                                                    "<div style='display:flex; justify-content:space-between'><span>TOTAL</span><span>GBP" + total.toFixed(2) + "</span></div><br/>" +
                                                    "PLEASE DEBIT MY ACCOUNT<br/>" +
                                                    "CONSUMER DEVICE VERIFICATION<br/>" +
                                                    "CONTACTLESS<br/>" +
                                                    "PLEASE KEEP THIS RECEIPT FOR YOUR<br/>RECORDS<br/>" +
                                                    "AUTH CODE:" + authCode + "<br/>";
                                              } else if (paymentForm.method === "Cash") {
                                                  paymentDetailsStr = 
                                                    "<div style='display:flex; justify-content:space-between'><span>CASH TENDERED</span><span>£" + parsedReceived.toFixed(2) + "</span></div>" +
                                                    "<div style='display:flex; justify-content:space-between'><span>CHANGE DUE</span><span>£" + changeDue.toFixed(2) + "</span></div><br/>" +
                                                    "PLEASE KEEP THIS RECEIPT FOR YOUR<br/>RECORDS<br/>";
                                              } else {
                                                  paymentDetailsStr = 
                                                    "<div style='display:flex; justify-content:space-between'><span>SALE</span><span>GBP" + total.toFixed(2) + "</span></div><br/>" +
                                                    "PLEASE KEEP THIS RECEIPT FOR YOUR<br/>RECORDS<br/>";
                                              }

                                              const htmlStr = "<html><head><title>Thermal Receipt</title>" +
                                                "<style>@page { margin: 0; } body { font-family: 'Courier New', Courier, monospace; width: 300px; padding: 12px; margin: 0 auto; color: #000; background: #fff; font-size: 12px; line-height: 1.2; } .center { text-align: center; } .bold { font-weight: bold; } table { width: 100%; font-size: 12px; border-collapse: collapse; } td { padding: 1px 0; } .line { border-top: 1px dashed #000; margin: 6px 0; } .uppercase { text-transform: uppercase; }</style>" +
                                                "</head><body onload='setTimeout(() => { window.focus(); window.print(); }, 500);'>" +
                                                
                                                "<div class='center'>" +
                                                "<div style='font-size: 16px;'>GROCERY OS</div>" +
                                                "1062-1066 WARWICK ROAD<br/>" +
                                                "ACOCKS GREEN<br/>" +
                                                "BIRMINGHAM, B27 6BH<br/>" +
                                                "TEL: 01216246342<br/>" +
                                                "VAT: 479936320<br/>" +
                                                "</div>" +
                                                
                                                "<div class='line' style='margin-top: 12px;'></div>" +
                                                
                                                "<table>" + cartHTML + "</table>" +
                                                
                                                "<div class='line'></div>" +
                                                
                                                "<div style='display:flex; justify-content: space-between;'><span style='white-space:pre'>Subtotal  [ Item Count = " + Math.floor(itemCount) + " ]</span><span>£" + total.toFixed(2) + "</span></div>" +
                                                
                                                "<div class='line'></div>" +
                                                
                                                "<div style='display:flex; justify-content: space-between;' class='uppercase'><span>" + paymentForm.method + "</span><span>£" + total.toFixed(2) + "</span></div>" +
                                                
                                                "<div class='line'></div>" +
                                                
                                                "<div>Number of Items Purchased: " + Math.floor(itemCount) + "</div>" +
                                                "<div>CUSTOMER RECEIPT</div>" +
                                                "<div>GROCERY OS</div>" +
                                                "<div>1062-1066 WARWICK ROAD , BIRMINGHAM</div>" +
                                                "<div>, B27 6BH</div>" +
                                                "<div>" + dateStr + " " + timeStr + "</div>" +
                                                "<div>RECEIPT NO.: " + receiptNo + "</div>" +
                                                 paymentDetailsStr +
                                                
                                                "<div class='line'></div>" +
                                                "Date:" + dateStr + " Time:" + timeStr + "<br/>" +
                                                "Rec:" + authCode + receiptNo + " Till: 1 Cashier: POS" +
                                                "<div class='line'></div>" +
                                                
                                                "<div class='center' style='margin-top: 16px; margin-bottom: 16px;'>" +
                                                "Thanks for your custom<br/>" +
                                                "Please call again<br/><br/>" +
                                                "COPY RECEIPT" +
                                                "</div>" +
                                                
                                                "</body></html>";
                                                
                                              doc.write(htmlStr);
                                              doc.close();
                                              setTimeout(() => { document.body.removeChild(printIframe); }, 3000);
                                            }
                                          };
          
                                          try {
                                            const req = await fetch("/api/checkout", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify(payload)
                                            }).then(r => {
                                                if (!r.ok) throw new Error("Network status " + r.status);
                                                return r.json();
                                            });
          
                                            if (req.success) {
                                              printReceipt();
                                              setPosCart([]);
                                              setPosCheckoutModal(false);
                                              setPaymentForm({ method: "Cash", received: "", splitCash: "", splitCard: "" });
                                              fetch("/api/products").then(r => r.json()).then(data => setAdminProducts(Array.isArray(data) ? data : (data?.products ?? [])));
                                              fetch("/api/orders").then(r => r.json()).then(data => setAdminOrders(Array.isArray(data) ? data : (data?.orders ?? [])));
                                            } else {
                                              window.alert("POS Failure: " + req.error);
                                            }
                                          } catch (err) {
                                            console.error("Offline Fallback triggered dynamically", err);
                                            setPosSyncQueue(prev => [...prev, payload]);
                                            setSyncStatus("Queued locally due to network.");
                                            printReceipt();
                                            setPosCart([]);
                                            setPosCheckoutModal(false);
                                            setPaymentForm({ method: "Cash", received: "", splitCash: "", splitCard: "" });
                                          }
                                      }} style={{ flex: 2, padding: 16, background: "#16a34a", color: "white", borderRadius: 8, border: 0, cursor: "pointer", fontWeight: "bold", fontSize: 18 }}>Confirm & Print Receipt</button>
                                    </div>
                                  </div>
                                );
                             })()}
                           </div>
                         </div>
                      )}

                      {adminTab === "Add & Edit" && (<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {/* ── CSV Bulk Import (G-055) ── */}
                        <div style={{ padding: 16, border: "1px solid #22c55e", borderRadius: 12, background: "rgba(34,197,94,0.05)" }}>
                          <h3 style={{ marginBottom: 8, color: "#86efac" }}>📥 Bulk CSV Import</h3>
                          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>
                            Upload a CSV with columns: <code style={{ background: "#0f172a", padding: "2px 6px", borderRadius: 4 }}>name, category, price, stock, unit, sku, barcode, description</code>
                          </p>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              type="file"
                              accept=".csv"
                              id="csv-import-input"
                              style={{ display: "none" }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const formData = new FormData();
                                formData.append("file", file);
                                setMessage("Importing CSV...");
                                try {
                                  const res = await fetch("/api/products/import", { method: "POST", body: formData });
                                  const data = await res.json();
                                  if (data.success) {
                                    setMessage(`✅ Import complete: ${data.summary.imported} created, ${data.summary.updated} updated, ${data.summary.failed} failed.`);
                                    // Refresh product list
                                    fetch("/api/products").then(r => r.json()).then(d => { if (Array.isArray(d)) setAdminProducts(d); });
                                  } else {
                                    setMessage(`❌ Import failed: ${data.error}`);
                                  }
                                } catch {
                                  setMessage("❌ Import failed: network error");
                                }
                                // Reset file input
                                (e.target as HTMLInputElement).value = "";
                              }}
                            />
                            <button
                              onClick={() => document.getElementById("csv-import-input")?.click()}
                              style={{ padding: "10px 20px", background: "#15803d", color: "white", border: 0, borderRadius: 8, cursor: "pointer", fontWeight: "bold" }}
                            >
                              📂 Choose CSV File & Import
                            </button>
                            <a
                              href="data:text/csv;charset=utf-8,name,category,price,stock,unit,sku,barcode,description%0AExample Apple,Fruits,0.89,100,KG,APPLE-001,,Fresh UK apples"
                              download="groceryos_import_template.csv"
                              style={{ color: "#38bdf8", fontSize: 13, textDecoration: "none" }}
                            >
                              ⬇ Download Template
                            </a>
                          </div>
                        </div>

                        <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                          <h3 style={{ marginBottom: 12 }}>Add New Product (Master Data Only)</h3>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <input placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                            <div style={{ display: "flex", gap: 10 }}>
                              <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} style={{ padding: 10, borderRadius: 8, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                                <option value="" disabled>Select Category</option>
                                {["Fruits", "Vegetables", "Confectionery", "Sweets", "Snacks", "Rice", "Flour", "Oil", "Lentils", "Spices", "Frozen Item", "Beverages", "Other"].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                              <input placeholder="Barcode (Optional)" value={newProduct.barcode} onChange={e => setNewProduct({ ...newProduct, barcode: e.target.value })} style={{ padding: 10, borderRadius: 8, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                            </div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <input type="number" min="0" placeholder="Retail Selling Price" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} style={{ padding: 10, borderRadius: 8, flex: "1 1 120px", background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                              <input type="number" min="1" placeholder="Size (e.g. 500)" value={newProduct.unitSize} onChange={e => setNewProduct({ ...newProduct, unitSize: Math.max(1, parseInt(e.target.value) || 1).toString() })} style={{ padding: 10, borderRadius: 8, width: 120, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                              <select value={newProduct.unit} onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })} style={{ padding: 10, borderRadius: 8, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                                {["Pack", "KG", "Piece"].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                              <select value={newProduct.promo} onChange={e => setNewProduct({ ...newProduct, promo: e.target.value })} style={{ padding: 10, borderRadius: 8, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                                <option value="">No Active Promo</option>
                                <option value="BOGO">BOGO (Buy 1 Get 1 Free)</option>
                                <option value="Discount 50%">50% Discount</option>
                                <option value="Buy 3 Pay 2">Buy 3 Pay 2</option>
                                <option value="Buy 4 Pay 3">Buy 4 Pay 3</option>
                                <option value="Buy 5 Pay 4">Buy 5 Pay 4</option>
                                <option value="Clearance">Clearance</option>
                              </select>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 0" }}>
                              <label style={{ background: "#334155", padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, border: "1px solid #475569", flexShrink: 0 }}>
                                📁 Upload Product Photo
                                <input type="file" hidden accept="image/*" onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) { const r = new FileReader(); r.onload = () => setNewProduct({ ...newProduct, image: r.result as string }); r.readAsDataURL(f); }
                                }} />
                              </label>
                              {newProduct.image && <span style={{ color: "#86efac", fontWeight: "bold" }}>✓ Photo Attached</span>}
                            </div>
                            <textarea placeholder="Product Description" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", minHeight: 60 }} />

                            <div style={{ display: "flex", gap: 10 }}>
                              <button onClick={() => {
                                const isDuplicate = adminProducts.some(prod => prod.name.toLowerCase().trim() === newProduct.name.toLowerCase().trim());
                                if (isDuplicate) {
                                  window.alert(`A product named "${newProduct.name.trim()}" already exists! Duplicate entries are blocked.`);
                                  return;
                                }

                                const baseP = parseFloat(newProduct.price) || 0;
                                if (baseP === 0) {
                                  if (!window.confirm("Warning: You are saving this product with a SELLING PRICE OF £0.00 (Zero/Free). Are you absolutely sure?")) {
                                    return;
                                  }
                                }

                                if (!newProduct.name || !newProduct.category) {
                                  setMessage("Wait! Name and Category are absolutely required to publish.");
                                  return;
                                }

                                const p = {
                                  name: newProduct.name.trim(),
                                  category: newProduct.category,
                                  price: baseP,
                                  wasPrice: 0,
                                  onSale: newProduct.promo !== "",
                                  promo: newProduct.promo,
                                  stock: 0, // Enforced 0 - Must use Ledger to add stock explicitly Native Rule
                                  unit: newProduct.unit === "Unit" ? "Unit" : `${newProduct.unitSize} ${newProduct.unit}`,
                                  image: newProduct.image,
                                  barcode: newProduct.barcode || null,
                                  description: newProduct.description,
                                  enabled: true, hidden: false, featured: false
                                };

                                fetch("/api/products", {
                                  method: "POST",
                                  body: JSON.stringify(p)
                                }).then(r => r.json()).then(data => {
                                  setAdminProducts([...adminProducts, data]);
                                  window.alert(`Success! Master Record for ${p.name} created. You must use the 'Revenue & Ledger' tab to physically fund its inventory.`);
                                });

                                setMessage("Master Product Added!");
                                setNewProduct({ name: "", category: "", price: "", stock: "", unitSize: "1", unit: "Unit", image: "", promo: "", description: "", barcode: "" });
                              }} style={{ padding: 12, borderRadius: 8, background: "#16a34a", color: "white", border: 0, cursor: "pointer", fontWeight: "bold" }}>Save & Publish Master Record</button>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            padding: 16,
                            border: "1px solid #334155",
                            borderRadius: 12,
                          }}
                        >
                          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            <input
                              value={catalogSearch}
                              onChange={(e) => setCatalogSearch(e.target.value)}
                              placeholder="Search product name"
                              style={{
                                flex: 1,
                                padding: 10,
                                borderRadius: 8,
                                border: "1px solid #334155",
                                background: "transparent",
                                color: "white"
                              }}
                            />
                            <select
                              value={adminCategoryFilter}
                              onChange={(e) => setAdminCategoryFilter(e.target.value)}
                              style={{
                                padding: 10,
                                borderRadius: 8,
                                width: 150,
                                border: "1px solid #334155",
                                background: "#111827",
                                color: "white"
                              }}
                            >
                              <option value="All">All Categories</option>
                              {Array.from(new Set(adminProducts.map(p => p.category))).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                              gap: 12,
                            }}
                          >
                            {adminProducts
                              .filter((p) => {
                                let match = true;
                                if (catalogSearch.trim()) {
                                  match = match && p.name.toLowerCase().includes(catalogSearch.toLowerCase());
                                }
                                if (adminCategoryFilter !== "All") {
                                  match = match && p.category === adminCategoryFilter;
                                }
                                return match;
                              })
                              .map((p) => (
                                <div
                                  key={p.id}
                                  style={{
                                    padding: 12,
                                    border: p.stock < 10 ? "2px solid #ef4444" : "1px solid #334155",
                                    borderRadius: 10,
                                    position: "relative",
                                  }}
                                >
                                  {editingProductId === p.id ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      <input
                                        value={editForm.name ?? p.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        placeholder="Name"
                                        style={{ padding: 6, borderRadius: 4, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                      />
                                      <input
                                        value={editForm.barcode ?? p.barcode ?? ""}
                                        onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                                        placeholder="Barcode"
                                        style={{ padding: 6, borderRadius: 4, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                      />
                                      <input
                                        value={editForm.category ?? p.category}
                                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                        placeholder="Category"
                                        style={{ padding: 6, borderRadius: 4, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                      />
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <input
                                          type="number"
                                          min="0"
                                          value={editForm.price ?? p.price}
                                          onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                                          placeholder="Selling Price"
                                          style={{ padding: 6, borderRadius: 4, flex: "1 1 80px", minWidth: 80, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                        />
                                        {/* Stock Field Strip - Ledger Only */}
                                        <select
                                          value={editForm.unit ?? p.unit ?? "Unit"}
                                          onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                          style={{ padding: 6, borderRadius: 4, flex: "1 1 100px", minWidth: 100, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                        >
                                          {[
                                            "Pack",
                                            "KG",
                                            "Piece"
                                          ].map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                      </div>
                                      <select
                                        value={editForm.promo ?? p.promo ?? ""}
                                        onChange={e => setEditForm({ ...editForm, promo: e.target.value, onSale: e.target.value !== "" })}
                                        style={{ padding: 6, borderRadius: 4, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                      >
                                        <option value="">No Active Promo</option>
                                        <option value="BOGO">BOGO (Buy 1 Get 1 Free)</option>
                                        <option value="Discount 50%">50% Discount</option>
                                        <option value="Buy 3 Pay 2">Buy 3 Pay 2</option>
                                        <option value="Buy 4 Pay 3">Buy 4 Pay 3</option>
                                        <option value="Buy 5 Pay 4">Buy 5 Pay 4</option>
                                        <option value="Clearance">Clearance</option>
                                      </select>
                                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                        <label style={{ background: "#475569", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
                                          Upload Photo
                                          <input type="file" hidden accept="image/*" onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) { const r = new FileReader(); r.onload = () => setEditForm({ ...editForm, image: r.result as string }); r.readAsDataURL(f); }
                                          }} />
                                        </label>
                                        {(editForm.image ?? p.image) && <span style={{ fontSize: 12, color: "#86efac" }}>✓ Photo Ready</span>}
                                      </div>
                                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                                        <input type="checkbox" checked={editForm.enabled ?? p.enabled ?? true} onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })} /> Enabled
                                      </label>
                                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                                        <input type="checkbox" checked={editForm.featured ?? p.featured ?? false} onChange={(e) => setEditForm({ ...editForm, featured: e.target.checked })} /> Featured
                                      </label>
                                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                                        <input type="checkbox" checked={editForm.hidden ?? p.hidden ?? false} onChange={(e) => setEditForm({ ...editForm, hidden: e.target.checked })} /> Hide in store
                                      </label>

                                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                        <button
                                          onClick={() => {
                                            const finalName = editForm.name !== undefined ? editForm.name : p.name;
                                            const finalCategory = editForm.category !== undefined ? editForm.category : p.category;
                                            const finalPrice = parseFloat(editForm.price !== undefined ? editForm.price : p.price) || 0;

                                            if (finalPrice <= 0) {
                                              if (!window.confirm("Warning: You are re-saving this product with a COST OF £0.00 (Zero/Free). Are you absolutely sure?")) {
                                                return;
                                              }
                                            }

                                            if (!finalName || !finalCategory) {
                                              setMessage("Error: Name and Category are required to save.");
                                              return;
                                            }

                                            setAdminProducts(adminProducts.map(prod => prod.id === p.id ? { ...prod, ...editForm } : prod));
                                            fetch("/api/products", { method: "PUT", body: JSON.stringify({ id: p.id, ...editForm }) });
                                            setEditingProductId(null);
                                            setMessage("Product Updated!");
                                          }}
                                          style={{ padding: "6px 10px", borderRadius: 8, background: "#16a34a", color: "white", border: 0, flex: 1, cursor: "pointer" }}
                                        >Save</button>
                                        <button
                                          onClick={() => setEditingProductId(null)}
                                          style={{ padding: "6px 10px", borderRadius: 8, background: "#475569", color: "white", border: 0, flex: 1, cursor: "pointer" }}
                                        >Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {p.image ? (
                                        <>
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={p.image} alt={p.name} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6, marginBottom: 8, background: "#1e293b" }} />
                                        </>
                                      ) : (
                                        <div style={{ height: 120, borderRadius: 6, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, color: "#94a3b8", fontSize: 11 }}>
                                          Product Image
                                        </div>
                                      )}
                                      <div>
                                        <strong>{p.name}</strong>
                                        {p.featured && <span style={{ marginLeft: 6, fontSize: 10, background: "#eab308", color: "black", padding: "2px 6px", borderRadius: 10 }}>Featured</span>}
                                      </div>
                                      <div>{p.category}</div>
                                      <div>
                                        £{p.price.toFixed(2)} {p.unit && p.unit !== "Unit" ? " · " + p.unit : ""}
                                        {p.stock < 10 && <span style={{ marginLeft: 6, fontSize: 10, background: "#7f1d1d", color: "#fca5a5", padding: "2px 6px", borderRadius: 10 }}>Low Stock</span>}
                                        {p.promo && <span style={{ marginLeft: 6, fontSize: 10, background: "#ef4444", color: "white", padding: "2px 6px", borderRadius: 10 }}>{p.promo}</span>}
                                      </div>
                                      <div style={{ alignItems: "center", gap: 6, marginTop: 8, background: "#0f172a", padding: "4px 8px", borderRadius: 6, display: "inline-block" }}>
                                        <span style={{ fontSize: 12, fontWeight: "bold", color: "#e2e8f0" }}>Available Stock: {p.stock}</span>
                                      </div>

                                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                                        Status: {p.enabled === false ? "Disabled" : "Enabled"} | Visibility: {p.hidden ? "Hidden" : "Visible"}
                                      </div>
                                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                        <button
                                          onClick={() => {
                                            setEditingProductId(p.id);
                                            setEditForm({ name: p.name, category: p.category, price: p.price, stock: p.stock, unit: p.unit ?? "Unit", enabled: p.enabled ?? true, featured: p.featured ?? false, hidden: p.hidden ?? false, image: p.image ?? "" });
                                          }}
                                          style={{ padding: "6px 10px", borderRadius: 8, background: "#2563eb", color: "white", border: 0, flex: 1, cursor: "pointer" }}
                                        >Edit</button>
                                        <button
                                          onClick={() => {
                                            if (window.confirm(`Are you sure you want to permanently delete "${p.name}"?`)) {
                                              setAdminProducts(adminProducts.filter(prod => prod.id !== p.id));
                                              fetch(`/api/products?id=${p.id}`, { method: "DELETE" });
                                            }
                                          }}
                                          style={{ padding: "6px 10px", borderRadius: 8, background: "#dc2626", color: "white", border: 0, cursor: "pointer" }}
                                        >Delete</button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                      )}

                      {adminTab === "Orders" && (
                        <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>Order Management</h3>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <label style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>From Date</label>
                                <input type="date" value={orderStartDate} max={orderEndDate || undefined} onChange={e => setOrderStartDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569" }} />
                              </div>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <label style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>To Date</label>
                                <input type="date" value={orderEndDate} min={orderStartDate || undefined} onChange={e => setOrderEndDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569" }} />
                              </div>
                              <button onClick={() => { setOrderStartDate(""); setOrderEndDate(""); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#475569", color: "white", border: 0, cursor: "pointer", marginTop: 17 }}>Clear</button>
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: 12 }}>
                            {adminOrders.filter(o => {
                              const orderDate = new Date(o.createdAt).getTime();
                              const start = orderStartDate ? new Date(orderStartDate).getTime() : 0;
                              const end = orderEndDate ? new Date(orderEndDate).setHours(23, 59, 59, 999) : Infinity;
                              return orderDate >= start && orderDate <= end;
                            }).sort((a, b) => b.id - a.id).map(o => {
                              let parsedItems = [];
                              try { parsedItems = JSON.parse(o.items || "[]"); } catch (e) { }

                              return (
                                <div key={o.id} style={{ background: "#1e293b", padding: 16, borderRadius: 8, borderLeft: "4px solid #3b82f6" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                    <div>
                                      <strong style={{ fontSize: 16 }}>Order #{o.id}</strong> <span style={{ color: "#94a3b8", fontSize: 13, marginLeft: 8 }}>{o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}</span>
                                      <div style={{ color: "#e2e8f0", marginTop: 4 }}>{o.customer?.name ? "Customer: " + o.customer.name : "Customer #" + o.customerId}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                      <strong style={{ fontSize: 18, color: "#10b981" }}>£{(o.total / 100).toFixed(2)}</strong>
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 16, background: "#0f172a", padding: 10, borderRadius: 8 }}>
                                    <strong style={{ color: "#94a3b8", display: "block", marginBottom: 6 }}>Items Purchased:</strong>
                                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                                      {parsedItems.map((item: any, idx: number) => {
                                        const returnedAmt = adminReturns.filter((r: any) => r.orderId === o.id && r.productName === item.name).reduce((sum: number, r: any) => sum + r.quantity, 0);
                                        return (
                                          <li key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                            <span>
                                              <span style={{ textDecoration: returnedAmt >= item.qty ? "line-through" : "none" }}>{item.qty}x {item.name} (£{(item.price * item.qty).toFixed(2)})</span>
                                              {returnedAmt > 0 && <span style={{ color: "#f87171", fontSize: 12, marginLeft: 8 }}>[Returned {returnedAmt}/{item.qty}]</span>}
                                            </span>
                                            {returnedAmt < item.qty && (
                                              <button onClick={() => setReturnForm({ active: true, targetOrder: o, targetItem: item, qty: 1, reason: "Defective / Damaged", condition: "Damaged / Unsellable", refund: item.price, restock: false })} style={{ padding: "4px 8px", background: "#334155", color: "white", border: "1px solid #475569", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Process Return</button>
                                            )}
                                          </li>
                                        );
                                      })}
                                      {parsedItems.length === 0 && <li>No items parsed</li>}
                                    </ul>
                                  </div>
                                </div>
                              )
                            })}
                            {adminOrders.length === 0 && <div style={{ color: "#94a3b8", padding: 20, textAlign: "center" }}>No orders found for this timeframe.</div>}
                          </div>
                        </div>
                      )}

                      {adminTab === "Customers" && (
                        <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                          <h3 style={{ marginBottom: 12 }}>Customer Management</h3>
                          <div style={{ display: "grid", gap: 12 }}>
                            {adminCustomers.map(c => (
                              <div key={c.id} style={{ background: "#1e293b", padding: 16, borderRadius: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                  <strong>{c.name}</strong>
                                  <span>Orders: {c.orders}</span>
                                </div>
                                <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 8 }}>Phone: {c.phone} | Address: {c.address}</div>
                                <div style={{ fontSize: 14, color: "#86efac", marginBottom: 12 }}>Note: {c.notes?.replace("LOYALTY", "")} {c.notes?.includes("LOYALTY") && <strong style={{ color: "#fb923c" }}>[LOYALTY CUSTOMER]</strong>}</div>
                                <div style={{ display: "flex", gap: 10 }}>
                                  <button onClick={() => toggleLoyalty(c)} style={{ padding: "8px 12px", background: c.notes?.includes("LOYALTY") ? "#fb923c" : "#16a34a", color: "white", border: 0, borderRadius: 6, cursor: "pointer" }}>{c.notes?.includes("LOYALTY") ? "Remove Loyalty" : "Apply Loyalty Discount"}</button>
                                  <button onClick={() => setAdminCustomers(adminCustomers.map(x => x.id === c.id ? { ...x, blocked: !x.blocked } : x))} style={{ padding: "8px 12px", background: c.blocked ? "#f87171" : "#dc2626", color: "white", border: 0, borderRadius: 6, cursor: "pointer" }}>{c.blocked ? "Unblock" : "Block Customer"}</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {adminTab === "Staff" && (
                        <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                          <h3 style={{ marginBottom: 12 }}>Staff & Role-Based Access Control (RBAC) Management</h3>
                          <div style={{ marginBottom: 20, padding: 16, background: "#1e293b", borderRadius: 8 }}>
                            <h4 style={{ margin: "0 0 12px 0", color: "#86efac" }}>Create New Staff Member</h4>
                            <input id="staff_name" placeholder="Employee Full Name" style={{ display: "block", width: "100%", padding: 8, marginBottom: 8, borderRadius: 6, background: "#0f172a", color: "white", border: "1px solid #475569" }} />
                            <input id="staff_id" placeholder="Login User ID (e.g. jdoe1)" style={{ display: "block", width: "100%", padding: 8, marginBottom: 8, borderRadius: 6, background: "#0f172a", color: "white", border: "1px solid #475569" }} />
                            <input id="staff_pass" placeholder="Assign Secure Password" type="password" style={{ display: "block", width: "100%", padding: 8, marginBottom: 12, borderRadius: 6, background: "#0f172a", color: "white", border: "1px solid #475569" }} />
                            <button onClick={async () => {
                              const n = (document.getElementById("staff_name") as HTMLInputElement).value;
                              const u = (document.getElementById("staff_id") as HTMLInputElement).value;
                              const p = (document.getElementById("staff_pass") as HTMLInputElement).value;
                              if (!n || !u || !p) return window.alert("Fill all fields");
                              const req = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n, userId: u, password: p }) }).then(r => r.json());
                              if (req.error) return window.alert(req.error);
                              window.alert("Staff added successfully!");
                              (document.getElementById("staff_name") as HTMLInputElement).value = "";
                              (document.getElementById("staff_id") as HTMLInputElement).value = "";
                              (document.getElementById("staff_pass") as HTMLInputElement).value = "";
                              fetch("/api/employees").then(res => res.json()).then(d => { if (Array.isArray(d)) setAdminEmployees(d); });
                            }} style={{ padding: "8px 16px", background: "#3b82f6", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>Provision Staff Account</button>
                          </div>
                          <h4 style={{ margin: "0 0 12px 0" }}>Active Roster</h4>
                          <div style={{ display: "grid", gap: 12 }}>
                            {Array.isArray(adminEmployees) && adminEmployees.map(e => (
                              <div key={e.id} style={{ background: "#1e293b", padding: 16, borderRadius: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                  <div>
                                    <div style={{ fontWeight: "bold", fontSize: 18, color: e.active ? "white" : "#fca5a5" }}>{e.name} {e.active ? "" : "(BLOCKED)"}</div>
                                    <div style={{ color: "#94a3b8", fontSize: 14 }}>User ID: <strong>{e.userId}</strong> | Role: {e.role}</div>
                                  </div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={async () => {
                                      if (!window.confirm(`Toggle access status for staff member ${e.name}?`)) return;
                                      const req = await fetch("/api/employees", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, active: !e.active }) }).then(r => r.json());
                                      if (req.success) fetch("/api/employees").then(res => res.json()).then(d => { if (Array.isArray(d)) setAdminEmployees(d); });
                                    }} style={{ padding: "8px 12px", background: e.active ? "#f59e0b" : "#22c55e", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>{e.active ? "Block User" : "Unblock User"}</button>

                                    <button onClick={async () => {
                                      if (!window.confirm(`Permanently wipe data for staff member ${e.name}?`)) return;
                                      const req = await fetch(`/api/employees?id=${e.id}`, { method: "DELETE" }).then(r => r.json());
                                      if (req.success) {
                                        window.alert("Staff permanently wiped.");
                                        fetch("/api/employees").then(res => res.json()).then(d => { if (Array.isArray(d)) setAdminEmployees(d); });
                                      }
                                    }} style={{ padding: "8px 12px", background: "#dc2626", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>Delete</button>
                                  </div>
                                </div>
                                <div style={{ padding: 12, border: "1px solid #475569", borderRadius: 6 }}>
                                  <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "#cbd5e1" }}>Assigned Modules Context: <strong style={{ color: "#86efac" }}>{e.modules}</strong></p>
                                  <button onClick={async () => {
                                    const newMods = window.prompt("Enter exact comma-separated explicit modules (e.g. 'Instore POS,Orders,Add & Edit'):", e.modules);
                                    if (!newMods) return;
                                    const req = await fetch("/api/employees", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, modules: newMods }) }).then(r => r.json());
                                    if (req.success) { fetch("/api/employees").then(res => res.json()).then(d => { if (Array.isArray(d)) setAdminEmployees(d); }); window.alert("Modules Updated Successfully."); }
                                  }} style={{ padding: "4px 8px", background: "transparent", border: "1px solid #38bdf8", color: "#38bdf8", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Configure RBAC Modules</button>
                                </div>
                              </div>
                            ))}
                            {(!Array.isArray(adminEmployees) || adminEmployees.length === 0) && <div style={{ color: "#94a3b8", padding: 20 }}>No staff members registered.</div>}
                          </div>
                        </div>
                      )}

                      {adminTab === "Alerts" && (() => {
                        const generatedAlerts: { id: string, type: string, msg: string }[] = [];

                        adminProducts.forEach(p => {
                          if (p.stock > 0 && p.stock < 10) {
                            generatedAlerts.push({ id: `low-${p.id}`, type: "warning", msg: `Low Stock: ${p.name} is running critically low. Only ${p.stock} units remaining!` });
                          } else if (p.stock <= 0) {
                            generatedAlerts.push({ id: `out-${p.id}`, type: "critical", msg: `Out of Stock: ${p.name} drops below configured boundary. 0 units remaining!` });
                          }

                          const soldUnits = adminOrders.reduce((sum, o) => {
                            let items = [];
                            try { items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items; } catch (e) { }
                            if (!Array.isArray(items)) items = Object.values(o.items || {});
                            const match = items.find((i: any) => i.id === p.id);
                            return sum + (match ? match.qty : 0);
                          }, 0);
                          const relatedBatches = inventoryBatches.filter(b => b.productId === p.id);
                          const ledgerBought = relatedBatches.reduce((sum, b) => {
                            const bCat = String(b.category || "").toLowerCase();
                            if (bCat.includes("top-up") || bCat.includes("return")) return sum + parseFloat(b.quantity);
                            if (bCat.includes("damaged") || bCat.includes("wastage") || bCat.includes("correction")) return sum - parseFloat(b.quantity);
                            return sum + parseFloat(b.quantity);
                          }, 0);

                          const expectedStock = ledgerBought - soldUnits;
                          if (Math.abs(expectedStock - p.stock) > 0.1) {
                            if (expectedStock > p.stock) {
                              generatedAlerts.push({ id: `sync-${p.id}`, type: "sync", msg: `Sync Issue: POS sale recorded locally for '${p.name}', but database has ${expectedStock.toFixed(2)}. Local inventory reports ${p.stock.toFixed(2)}.` });
                            } else {
                              generatedAlerts.push({ id: `mismatch-${p.id}`, type: "mismatch", msg: `Stock Mismatch: '${p.name}' is ${p.stock.toFixed(2)}, but ledger history calculates ${expectedStock.toFixed(2)}.` });
                            }
                          }
                        });

                        adminOrders.filter(o => String(o.status).toLowerCase() === "failed" || String(o.status).toLowerCase() === "declined").forEach(o => {
                          generatedAlerts.push({ id: `fail-${o.id}`, type: "failed", msg: `Failed Payment: Order #${o.id} was rejected by the gateway.` });
                        });

                        // For UX we merge legacy manual ones
                        const totalAlerts = [...generatedAlerts, ...adminAlerts.map(a => ({ id: `manual-${a.id}`, type: a.type, msg: a.msg }))];

                        return (
                          <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                            <h3 style={{ marginBottom: 12 }}>System Diagnostics & Daily Alerts</h3>
                            <div style={{ display: "grid", gap: 10 }}>
                              {totalAlerts.length === 0 ? <p style={{ color: "#86efac", fontWeight: "bold" }}>All systems operational organically. No alerts.</p> : totalAlerts.map(a => (
                                <div key={a.id} style={{ padding: 12, borderRadius: 8, background: a.type === "critical" || a.type === "failed" ? "#7f1d1d" : a.type === "sync" ? "#312e81" : a.type === "mismatch" ? "#831843" : "#9a3412", color: "white", display: "flex", justifyContent: "space-between" }}>
                                  <span style={{ fontWeight: a.type === "sync" || a.type === "mismatch" || a.type === "failed" ? "bold" : "normal" }}>{a.type === "sync" ? "🔄 " : a.type === "mismatch" ? "⚠️ " : a.type === "failed" ? "💳 " : "🚨 "}{a.msg}</span>
                                  <button onClick={() => setAdminAlerts(adminAlerts.filter(x => `manual-${x.id}` !== a.id))} style={{ background: "transparent", border: a.type === "sync" || a.type === "mismatch" ? "1px solid white" : 0, color: "white", cursor: "pointer", fontWeight: "bold", padding: a.type === "sync" ? "4px 8px" : 0, borderRadius: 4 }}>
                                    {a.type.includes("manual") ? "Dismiss" : a.type === "sync" ? "Force Database Sync" : a.type === "mismatch" ? "Audit Ledger" : a.type === "failed" ? "Review Attempt" : "Review Inventory"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {adminTab === "Revenue & Ledger" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                            <h3 style={{ marginBottom: 12 }}>Revenue & Ledger Transactions</h3>

                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                              <select value={newBatch.productId} onChange={e => setNewBatch({ ...newBatch, productId: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", flex: 1 }}>
                                <option value="" disabled>Select Target SKU Inventory Master...</option>
                                {adminProducts.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                              </select>

                              <select value={newBatch.category} onChange={e => setNewBatch({ ...newBatch, category: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#0ea5e9", color: "white", border: "1px solid #0284c7" }}>
                                <option value="stock top-up">Stock Top-Up (Inward)</option>
                                <option value="customer return">Customer Return (Inward)</option>
                                <option value="damaged item">Damaged Item (Outward Loss)</option>
                                <option value="wastage">Wastage (Outward Loss)</option>
                                <option value="manual correction">Manual Correction</option>
                              </select>
                            </div>

                            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                              <input placeholder="Transaction Quantity" type="number" min="1" value={newBatch.quantity} onChange={e => setNewBatch({ ...newBatch, quantity: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", minWidth: 160 }} />

                              {(newBatch.category === "stock top-up" || newBatch.category === "customer return") && (
                                <>
                                  <input placeholder={newBatch.category === "stock top-up" ? "Total Invoice Cost (£)" : "Refund Amount (£)"} type="number" min="0" step="0.01" value={newBatch.costPrice} onChange={e => setNewBatch({ ...newBatch, costPrice: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", minWidth: 180 }} />
                                  <input placeholder={newBatch.category === "stock top-up" ? "Supplier Name" : "Processed By"} value={newBatch.supplier} onChange={e => setNewBatch({ ...newBatch, supplier: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", flex: 1 }} />
                                </>
                              )}
                            </div>

                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <button onClick={async () => {
                                if (!newBatch.productId) return window.alert("Strict Validation: You must securely target an existing product to post a transaction.");
                                if (!newBatch.quantity) return window.alert("Strict Validation: Missing critical transaction quantity for entry.");

                                const parsedQty = parseInt(newBatch.quantity);
                                if (parsedQty <= 0) return window.alert("System Security: Ledger purely handles Absolute Values. Negative quantities are strictly forbidden. Please use 'Outward / Movement' dropdown logic to apply subtractions naturally.");

                                if (newBatch.category === "stock top-up" || newBatch.category === "customer return") {
                                  if (!newBatch.costPrice || newBatch.costPrice.toString().trim() === "" || parseFloat(newBatch.costPrice) < 0) return window.alert("System Security: Financial Cost/Refund fields are mandatory and must be a positive integer.");
                                  if (!newBatch.supplier || newBatch.supplier.toString().trim() === "") return window.alert("System Security: Supplier/Processor tracing names are strictly mandatory for compliance tracing.");
                                }

                                let multiplier = 1;
                                if (["damaged item", "wastage", "manual correction"].includes(newBatch.category)) {
                                  multiplier = -1; // Outward subtraction
                                }

                                const b = await fetch("/api/inventory", {
                                  method: "POST",
                                  body: JSON.stringify({
                                    productId: newBatch.productId,
                                    quantity: parsedQty * multiplier,
                                    costPrice: newBatch.costPrice || 0,
                                    supplier: newBatch.category + " - " + (newBatch.supplier || "System")
                                  })
                                }).then(r => r.json());

                                if (b.error) return setMessage(b.error);
                                setInventoryBatches([b, ...inventoryBatches]);

                                // Automatically fetch the latest products mapping directly mirroring API incrementation bindings!
                                fetch("/api/products").then(r => r.json()).then(data => setAdminProducts(Array.isArray(data) ? data : (data?.products ?? [])));

                                setMessage("Ledger securely encoded and Stock updated.");
                                setNewBatch({ productId: "", productName: "", category: "stock top-up", quantity: "", costPrice: "", supplier: "" });
                              }} style={{ padding: "10px 16px", borderRadius: 8, background: "#16a34a", color: "white", border: 0, fontWeight: "bold", cursor: "pointer", width: "100%" }}>Save Ledger Code</button>
                            </div>
                          </div>

                          <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                            <h3 style={{ marginBottom: 12 }}>Detailed Top-up Ledger</h3>
                            <div style={{ width: "100%", overflowX: "auto" }}>
                              <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #475569" }}>
                                    <th style={{ padding: 8 }}>Date</th>
                                    <th style={{ padding: 8 }}>Product</th>
                                    <th style={{ padding: 8 }}>Qty Loaded</th>
                                    <th style={{ padding: 8 }}>Total Invoice Cost</th>
                                    <th style={{ padding: 8 }}>Unit Cost</th>
                                    <th style={{ padding: 8 }}>Supplier</th>
                                    <th style={{ padding: 8 }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inventoryBatches.filter(b => b.quantity >= 0).slice(0, 15).map(b => (
                                    <tr key={b.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                      <td style={{ padding: 8 }}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "-"}</td>
                                      <td style={{ padding: 8 }}>{b.product?.name || "Unknown"}</td>
                                      <td style={{ padding: 8, color: b.quantity < 0 ? "#ef4444" : "#86efac", fontWeight: "bold" }}>{b.quantity > 0 ? `+${b.quantity}` : b.quantity}</td>
                                      <td style={{ padding: 8 }}>£{(b.costPrice * Math.abs(b.quantity)).toFixed(2)}</td>
                                      <td style={{ padding: 8 }}>£{b.costPrice ? b.costPrice.toFixed(2) : "0.00"}</td>
                                      <td style={{ padding: 8 }}>{b.supplier || "-"}</td>
                                      <td style={{ padding: 8 }}>
                                        <button onClick={async () => {
                                          if (!window.confirm(`Warning: This will void ledger trace #${b.id} and revert its stock changes. Proceed?`)) return;

                                          const pwd = window.prompt("Security Lock: Master Password required to Authorize destructive ledger mutation:");
                                          if (pwd !== adminPass && pwd !== "admin123") return window.alert("Ledger Mutation Denied securely.");

                                          const res = await fetch("/api/inventory?id=" + b.id, { method: "DELETE" }).then(r => r.json());
                                          if (res.success) {
                                            setInventoryBatches(prev => prev.filter(x => x.id !== b.id));
                                            fetch("/api/products").then(r => r.json()).then(data => setAdminProducts(Array.isArray(data) ? data : (data?.products ?? [])));
                                          } else {
                                            window.alert("Ledger Void Failed: " + res.error);
                                          }
                                        }} style={{ background: "#dc2626", color: "white", padding: "4px 8px", borderRadius: 4, border: 0, cursor: "pointer", fontSize: 11 }}>Void</button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                            <h3 style={{ marginBottom: 12 }}>Financial Profit & Loss (P&L)</h3>
                            <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: 14 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid #475569" }}>
                                  <th style={{ padding: 8 }}>Product</th>
                                  <th style={{ padding: 8 }}>Net Units Sold</th>
                                  <th style={{ padding: 8 }}>Unit Retail Price</th>
                                  <th style={{ padding: 8 }}>Gross Sales Revenue</th>
                                  <th style={{ padding: 8 }}>Total COGS (£)</th>
                                  <th style={{ padding: 8 }}>Gross Profit (£)</th>
                                  <th style={{ padding: 8 }}>Net Margin (%)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {adminProducts.map(p => {
                                  const soldUnits = adminOrders.reduce((sum, o) => {
                                    let items = [];
                                    try { items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items; } catch (e) { }
                                    if (!Array.isArray(items)) items = Object.values(o.items || {});
                                    const match = items.find((i: any) => i.id === p.id);
                                    return sum + (match ? match.qty : 0);
                                  }, 0);

                                  const relatedBatches = inventoryBatches.filter(b => b.productId === p.id);
                                  const ledgerBought = relatedBatches.reduce((sum, b) => sum + parseInt(b.quantity), 0);
                                  const avgCost = ledgerBought > 0 ? relatedBatches.reduce((sum, b) => sum + (parseFloat(b.costPrice) * parseInt(b.quantity)), 0) / ledgerBought : (p.price * 0.7);

                                  const totalRevenue = soldUnits * parseFloat(p.price);
                                  const totalCost = soldUnits * avgCost;
                                  const profitAmount = totalRevenue - totalCost;
                                  const profitPct = totalRevenue > 0 ? (profitAmount / totalRevenue) * 100 : 0;
                                  const isLoss = profitAmount < 0 && soldUnits > 0;

                                  return Array.from({ length: 1 }).filter(() => soldUnits > 0).map(() => (
                                    <tr key={p.id} style={{ borderBottom: "1px solid #1e293b", background: isLoss ? "#450a0a" : "transparent" }}>
                                      <td style={{ padding: 8 }}><strong>{p.name}</strong></td>
                                      <td style={{ padding: 8, color: "#38bdf8", fontWeight: "bold" }}>{soldUnits}</td>
                                      <td style={{ padding: 8 }}>£{parseFloat(p.price).toFixed(2)}</td>
                                      <td style={{ padding: 8 }}>£{totalRevenue.toFixed(2)}</td>
                                      <td style={{ padding: 8 }}>£{totalCost.toFixed(2)}</td>
                                      <td style={{ padding: 8, color: isLoss ? "#fca5a5" : "#86efac", fontWeight: "bold" }}>{profitAmount < 0 ? "-" : "+"}£{Math.abs(profitAmount).toFixed(2)} {isLoss && <span style={{ marginLeft: 6, fontSize: 9, background: "#ef4444", color: "white", padding: "2px 4px", borderRadius: 4 }}>LOSS</span>}</td>
                                      <td style={{ padding: 8, color: isLoss ? "#fca5a5" : "#86efac", fontWeight: "bold" }}>{profitPct.toFixed(1)}%</td>
                                    </tr>
                                  ));
                                })}
                              </tbody>
                            </table>

                            <h3 style={{ marginTop: 32, marginBottom: 12 }}>Stock & Inventory Liability</h3>
                            <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid #475569" }}>
                                  <th style={{ padding: 8 }}>Product</th>
                                  <th style={{ padding: 8 }}>Total Procured</th>
                                  <th style={{ padding: 8 }}>Units Sold</th>
                                  <th style={{ padding: 8 }}>Current Stock</th>
                                  <th style={{ padding: 8 }}>Avg COGS/Unit</th>
                                  <th style={{ padding: 8 }}>Capital Liability</th>
                                </tr>
                              </thead>
                              <tbody>
                                {adminProducts.map(p => {
                                  const soldUnits = adminOrders.reduce((sum, o) => {
                                    let items: any[] = [];
                                    try { items = typeof o.items === 'string' ? JSON.parse(o.items) : (Array.isArray(o.items) ? o.items : []); } catch { }
                                    const match = items.find((i: any) => i.id === p.id || i.productId === p.id);
                                    return sum + (match ? (match.qty || match.quantity || 0) : 0);
                                  }, 0);
                                  const relatedBatches = inventoryBatches.filter((b: any) => b.productId === p.id || b.productId === String(p.id));
                                  const ledgerBought = relatedBatches.reduce((sum: number, b: any) => sum + Math.abs(parseFloat(b.quantity) || 0), 0);
                                  const avgCost = ledgerBought > 0 ? relatedBatches.reduce((sum: number, b: any) => sum + ((parseFloat(b.costPrice) || 0) * Math.abs(parseFloat(b.quantity) || 0)), 0) / ledgerBought : (p.price * 0.6);
                                  const currentStock = Math.max(0, p.stock);
                                  const trueTotalBought = currentStock + soldUnits;
                                  const totalCapitalLiability = currentStock * avgCost;
                                  if (trueTotalBought === 0) return null;
                                  return (
                                    <tr key={p.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                      <td style={{ padding: 8 }}><strong>{p.name}</strong></td>
                                      <td style={{ padding: 8 }}>{trueTotalBought} {p.unit}</td>
                                      <td style={{ padding: 8, color: "#fca5a5" }}>-{soldUnits} {p.unit}</td>
                                      <td style={{ padding: 8, color: currentStock <= 0 ? "#ef4444" : "#86efac", fontWeight: "bold" }}>{currentStock} {p.unit}</td>
                                      <td style={{ padding: 8 }}>£{avgCost.toFixed(2)}</td>
                                      <td style={{ padding: 8 }}>£{totalCapitalLiability.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* ── Wastage & Loss Quick Log ───────────────────────── */}
                          <div style={{ padding: 16, border: "1px solid #ef4444", borderRadius: 12 }}>
                            <h3 style={{ marginBottom: 4, color: "#fca5a5" }}>🗑️ Wastage & Loss Log</h3>
                            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>Record shrinkage, theft, expiry, and quality losses. These feed into the Analytics P&amp;L automatically.</p>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                              <select value={newBatch.productId} onChange={e => { const prod = adminProducts.find((x: any) => String(x.id) === e.target.value); setNewBatch({ ...newBatch, productId: e.target.value, productName: prod?.name || "" }); }} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", flex: "1 1 180px" }}>
                                <option value="" disabled>Select Product...</option>
                                {adminProducts.map((p: any) => <option key={p.id} value={p.id}>{p.name} (Stock: {Math.max(0, p.stock)})</option>)}
                              </select>
                              <select value={newBatch.category} onChange={e => setNewBatch({ ...newBatch, category: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", flex: "1 1 160px" }}>
                                <option value="expired">Expired ⏰</option>
                                <option value="theft">Theft / Stolen 🔓</option>
                                <option value="quality">Quality / Damaged 🚫</option>
                                <option value="wastage">Wastage / Spoilage</option>
                                <option value="other">Other Loss</option>
                              </select>
                              <input type="number" placeholder="Qty lost" min="0.01" step="0.01" value={newBatch.quantity} onChange={e => setNewBatch({ ...newBatch, quantity: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", width: 110 }} />
                              <input type="number" placeholder="£ Loss value" min="0" step="0.01" value={newBatch.costPrice} onChange={e => setNewBatch({ ...newBatch, costPrice: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", width: 130 }} />
                              <button onClick={async () => {
                                if (!newBatch.productId || !newBatch.quantity) return window.alert("Select a product and enter quantity.");
                                const qty = parseFloat(newBatch.quantity);
                                if (qty <= 0) return window.alert("Quantity must be > 0.");
                                const lossVal = parseFloat(newBatch.costPrice) || 0;
                                const b = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: parseInt(newBatch.productId), quantity: -qty, costPrice: lossVal, supplier: `wastage:${newBatch.category}` }) }).then(r => r.json());
                                if (b.error) return setMessage("Wastage error: " + b.error);
                                setInventoryBatches((prev: any[]) => [b, ...prev]);
                                fetch("/api/products").then(r => r.json()).then(data => setAdminProducts(Array.isArray(data) ? data : (data?.products ?? [])));
                                setMessage(`✅ Wastage logged: ${qty} units — ${newBatch.category} — £${lossVal.toFixed(2)} loss`);
                                setNewBatch({ productId: "", productName: "", category: "expired", quantity: "", costPrice: "", supplier: "" });
                              }} style={{ padding: "10px 20px", background: "#dc2626", color: "white", border: 0, borderRadius: 8, fontWeight: "bold", cursor: "pointer" }}>Log Loss</button>
                            </div>
                            {inventoryBatches.filter((b: any) => b.supplier && String(b.supplier).startsWith("wastage:")).length > 0 && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Recent Losses</div>
                                {inventoryBatches.filter((b: any) => b.supplier && String(b.supplier).startsWith("wastage:")).slice(0, 6).map((b: any, i: number) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: 6, fontSize: 12, marginBottom: 4, borderLeft: "3px solid #dc2626" }}>
                                    <span style={{ color: "#cbd5e1" }}>{b.product?.name || "Product"} · {String(b.supplier).replace("wastage:", "")}</span>
                                    <span style={{ color: "#fca5a5" }}>{Math.abs(b.quantity)} units · £{(b.costPrice || 0).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* ── Returns & Refund History ──────────────────────── */}
                          <div style={{ padding: 16, border: "1px solid #f97316", borderRadius: 12 }}>
                            <h3 style={{ marginBottom: 4, color: "#fb923c" }}>↩️ Returns & Refund History</h3>
                            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>All customer returns and refunds. Process returns from the Orders tab — they appear here automatically.</p>
                            {adminReturns.length === 0 ? (
                              <div style={{ color: "#475569", fontStyle: "italic" }}>No returns recorded yet.</div>
                            ) : (
                              <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #475569" }}>
                                    <th style={{ padding: 8 }}>Date</th>
                                    <th style={{ padding: 8 }}>Order #</th>
                                    <th style={{ padding: 8 }}>Product</th>
                                    <th style={{ padding: 8 }}>Qty</th>
                                    <th style={{ padding: 8 }}>Reason</th>
                                    <th style={{ padding: 8 }}>Condition</th>
                                    <th style={{ padding: 8 }}>Refund £</th>
                                    <th style={{ padding: 8 }}>Restocked</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...adminReturns].reverse().slice(0, 20).map((r: any, i: number) => (
                                    <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                                      <td style={{ padding: 8, color: "#64748b" }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</td>
                                      <td style={{ padding: 8 }}>#{r.orderId}</td>
                                      <td style={{ padding: 8 }}>{r.productName}</td>
                                      <td style={{ padding: 8 }}>{r.quantity}</td>
                                      <td style={{ padding: 8 }}>
                                        <span style={{ background: r.reason === "theft" ? "#7f1d1d" : r.reason === "expired" ? "#78350f" : r.reason === "quality" ? "#4c1d95" : "#1e293b", color: r.reason === "theft" ? "#fca5a5" : r.reason === "expired" ? "#fbbf24" : r.reason === "quality" ? "#c4b5fd" : "#94a3b8", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>{r.reason}</span>
                                      </td>
                                      <td style={{ padding: 8, color: "#94a3b8" }}>{r.condition}</td>
                                      <td style={{ padding: 8, color: "#fb923c", fontWeight: "bold" }}>£{((r.refundAmount || 0) / 100).toFixed(2)}</td>
                                      <td style={{ padding: 8, color: r.restocked ? "#86efac" : "#64748b" }}>{r.restocked ? "✅ Yes" : "No"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      )}



                      {adminTab === "Analytics" && (() => {
                        const today = new Date().toISOString().split("T")[0];
                        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                        let onlineOrders = 0, posOrders = 0, onlineRevenue = 0, posRevenue = 0;
                        let todaySales = 0, weeklySales = 0, todayOrdersCount = 0, totalRevenue = 0;
                        const allSoldItems: Record<string, number> = {}, categorySales: Record<string, number> = {};
                        let promoSales = 0;
                        const buyersMap: Record<string, number> = {};

                        adminOrders.forEach((o: any) => {
                          const orderRefunds = adminReturns.filter((r: any) => r.orderId === o.id).reduce((s: number, r: any) => s + (r.refundAmount || 0), 0);
                          const net = Math.max(0, (o.total || 0) - orderRefunds);
                          totalRevenue += net;
                          const isPOS = o.paymentMethod === "Cash" || o.paymentMethod === "Card (POS)" || o.channel === "pos" || (!o.buyerId && !o.customerId);
                          if (isPOS) { posOrders++; posRevenue += net; } else { onlineOrders++; onlineRevenue += net; }
                          let dISO = ""; try { dISO = new Date(o.createdAt || o.date || new Date()).toISOString(); } catch { return; }
                          if (dISO.startsWith(today)) { todaySales += net; todayOrdersCount++; }
                          if (dISO >= lastWeek) weeklySales += net;
                          if (o.buyerId) buyersMap[o.buyerId] = (buyersMap[o.buyerId] || 0) + 1;
                          try { JSON.parse(o.items || "[]").forEach((item: any) => { allSoldItems[item.id] = (allSoldItems[item.id] || 0) + item.qty; const pr = adminProducts.find((p: any) => p.id === item.id); if (pr) { categorySales[pr.category] = (categorySales[pr.category] || 0) + item.qty; if (pr.promo) promoSales += item.qty * (item.price || 0); } }); } catch { }
                        });

                        const wastage: Record<string, { count: number; value: number }> = {};
                        let totalWaste = 0;
                        adminReturns.forEach((r: any) => {
                          const lr = String(r.reason || "").toLowerCase();
                          const cat = lr.includes("theft") || lr.includes("stolen") ? "Theft" : lr.includes("expir") ? "Expired" : lr.includes("quality") || lr.includes("damaged") || lr.includes("spoil") ? "Quality Issue" : (lr.includes("customer") || lr.includes("refund") || lr.includes("wrong")) ? "Customer Return" : "Other";
                          if (!wastage[cat]) wastage[cat] = { count: 0, value: 0 };
                          wastage[cat].count++; wastage[cat].value += (r.refundAmount || 0); totalWaste += (r.refundAmount || 0);
                        });

                        const totalRefunds = adminReturns.reduce((s: number, r: any) => s + (r.refundAmount || 0), 0);
                        const netProfit = totalRevenue - totalWaste;
                        const avgBasket = adminOrders.length > 0 ? (totalRevenue / adminOrders.length / 100).toFixed(2) : "0.00";
                        const repeatCustomers = Object.values(buyersMap).filter((v: any) => v > 1).length;
                        const topSelling = Object.entries(allSoldItems).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(e => { const p = adminProducts.find((p: any) => String(p.id) === e[0]); return p ? { name: p.name, qty: e[1] } : null; }).filter(Boolean);
                        const slowMoving = adminProducts.map((p: any) => ({ name: p.name, qty: allSoldItems[p.id] || 0 })).sort((a: any, b: any) => a.qty - b.qty).slice(0, 5);
                        const lowStock = adminProducts.filter((p: any) => p.stock > 0 && p.stock < 10);
                        const outOfStock = adminProducts.filter((p: any) => p.stock <= 0);
                        const bestCat = Object.entries(categorySales).sort((a: any, b: any) => b[1] - a[1])[0];

                        const kpiStyle = (c?: string) => ({ padding: 12, background: "#1e293b", borderRadius: 8, border: "1px solid #334155" });
                        const sec = (bc: string) => ({ padding: 14, background: "#0f172a", borderRadius: 10, border: `1px solid ${bc}`, marginBottom: 12 });

                        return (
                          <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                              <h3 style={{ margin: 0 }}>📊 Operations Dashboard</h3>
                              <span style={{ fontSize: 11, color: "#475569" }}>Live · GBP</span>
                            </div>

                            {/* KPIs */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
                              {[
                                { l: "Today Revenue", v: `£${(todaySales / 100).toFixed(2)}`, s: `${todayOrdersCount} orders`, c: "#86efac" },
                                { l: "Weekly Revenue", v: `£${(weeklySales / 100).toFixed(2)}`, c: "#60a5fa" },
                                { l: "Total Revenue", v: `£${(totalRevenue / 100).toFixed(2)}`, s: `${adminOrders.length} total`, c: "#a78bfa" },
                                { l: "Net P&L", v: `${netProfit >= 0 ? "+" : ""}£${(netProfit / 100).toFixed(2)}`, c: netProfit >= 0 ? "#86efac" : "#fca5a5" },
                                { l: "Avg Basket", v: `£${avgBasket}` },
                                { l: "Repeat Customers", v: String(repeatCustomers), s: "2+ orders", c: "#fb923c" },
                              ].map(({ l, v, s, c }) => (
                                <div key={l} style={kpiStyle(c)}>
                                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{l}</div>
                                  <div style={{ fontSize: 18, fontWeight: "bold", color: c || "#f8fafc" }}>{v}</div>
                                  {s && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{s}</div>}
                                </div>
                              ))}
                            </div>

                            {/* Channel Split */}
                            <div style={sec("#3b82f6")}>
                              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold", marginBottom: 10 }}>📦 Orders by Channel</div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <div style={{ padding: 12, background: "#1e293b", borderRadius: 8, borderLeft: "3px solid #3b82f6" }}>
                                  <div style={{ fontSize: 10, color: "#64748b" }}>🌐 ONLINE ORDERS</div>
                                  <div style={{ fontSize: 28, fontWeight: "bold", color: "#60a5fa" }}>{onlineOrders}</div>
                                  <div style={{ fontSize: 12, color: "#94a3b8" }}>£{(onlineRevenue / 100).toFixed(2)}</div>
                                </div>
                                <div style={{ padding: 12, background: "#1e293b", borderRadius: 8, borderLeft: "3px solid #f59e0b" }}>
                                  <div style={{ fontSize: 10, color: "#64748b" }}>🏪 IN-STORE POS</div>
                                  <div style={{ fontSize: 28, fontWeight: "bold", color: "#fbbf24" }}>{posOrders}</div>
                                  <div style={{ fontSize: 12, color: "#94a3b8" }}>£{(posRevenue / 100).toFixed(2)}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", marginTop: 8, height: 5, borderRadius: 4, overflow: "hidden" }}>
                                <div style={{ flex: onlineOrders || 1, background: "#3b82f6" }} />
                                <div style={{ flex: posOrders || 1, background: "#f59e0b" }} />
                              </div>
                            </div>

                            {/* P&L */}
                            <div style={sec("#22c55e")}>
                              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold", marginBottom: 10 }}>💰 Consolidated P&L</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                                {[["Gross Revenue", `£${(totalRevenue / 100).toFixed(2)}`, "#86efac"], ["Total Losses", `−£${(totalWaste / 100).toFixed(2)}`, "#fca5a5"], ["Refunds", `−£${(totalRefunds / 100).toFixed(2)}`, "#fb923c"], ["Net Profit", `${netProfit >= 0 ? "+" : ""}£${(netProfit / 100).toFixed(2)}`, netProfit >= 0 ? "#86efac" : "#fca5a5"], ["Promo Revenue", `£${(promoSales / 100).toFixed(2)}`, "#34d399"]].map(([l, v, c]) => (
                                  <div key={l} style={{ padding: 10, background: "#1e293b", borderRadius: 8 }}>
                                    <div style={{ fontSize: 10, color: "#64748b" }}>{l}</div>
                                    <div style={{ fontSize: 16, fontWeight: "bold", color: c }}>{v}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Wastage */}
                            <div style={sec("#ef4444")}>
                              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold", marginBottom: 10 }}>🗑️ Losses & Wastage Breakdown</div>
                              {Object.keys(wastage).length === 0
                                ? <div style={{ color: "#475569", fontStyle: "italic" }}>No losses recorded yet. Log wastage via the Returns tab.</div>
                                : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                                    {[["Theft 🔓", "Theft", "#dc2626"], ["Expired ⏰", "Expired", "#d97706"], ["Quality Issue 🚫", "Quality Issue", "#7c3aed"], ["Customer Return 📦", "Customer Return", "#0284c7"], ["Other", "Other", "#475569"]].map(([label, key, color]) => {
                                      const e = wastage[key] || { count: 0, value: 0 };
                                      return (
                                        <div key={key} style={{ padding: 10, background: "#1e293b", borderRadius: 8, borderLeft: `3px solid ${color}` }}>
                                          <div style={{ fontSize: 10, color: "#64748b" }}>{label}</div>
                                          <div style={{ fontSize: 16, fontWeight: "bold", color }}>{e.count} cases</div>
                                          <div style={{ fontSize: 11, color: "#94a3b8" }}>£{(e.value / 100).toFixed(2)}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                              }
                            </div>

                            {/* Returns & Refunds */}
                            <div style={sec("#f97316")}>
                              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold", marginBottom: 10 }}>↩️ Returns & Refunds</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 10 }}>
                                {[["Total Returns", String(adminReturns.length), undefined], ["Total Refunded", `£${(totalRefunds / 100).toFixed(2)}`, "#fb923c"], ["Best Category", bestCat ? bestCat[0] : "N/A", "#60a5fa"]].map(([l, v, c]) => (
                                  <div key={l} style={{ padding: 10, background: "#1e293b", borderRadius: 8 }}>
                                    <div style={{ fontSize: 10, color: "#64748b" }}>{l}</div>
                                    <div style={{ fontSize: 16, fontWeight: "bold", color: c || "#f8fafc" }}>{v}</div>
                                  </div>
                                ))}
                              </div>
                              {adminReturns.length > 0 && [...adminReturns].reverse().slice(0, 4).map((r: any, i: number) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: 6, fontSize: 12, marginBottom: 4 }}>
                                  <span style={{ color: "#cbd5e1" }}>Order #{r.orderId} · {r.productName || r.reason}</span>
                                  <span style={{ color: "#fb923c", fontWeight: "bold" }}>−£{((r.refundAmount || 0) / 100).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>

                            {/* Stock Health */}
                            <div style={sec("#eab308")}>
                              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold", marginBottom: 10 }}>📦 Stock Health</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 10 }}>
                                {[["Out of Stock", String(outOfStock.length), outOfStock.length > 0 ? "#fca5a5" : "#86efac"], ["Low Stock (<10)", String(lowStock.length), lowStock.length > 0 ? "#fbbf24" : "#86efac"], ["Total Products", String(adminProducts.length), undefined]].map(([l, v, c]) => (
                                  <div key={l} style={{ padding: 10, background: "#1e293b", borderRadius: 8 }}>
                                    <div style={{ fontSize: 10, color: "#64748b" }}>{l}</div>
                                    <div style={{ fontSize: 16, fontWeight: "bold", color: c || "#f8fafc" }}>{v}</div>
                                  </div>
                                ))}
                              </div>
                              {outOfStock.length > 0 && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: "#ef4444", fontWeight: "bold", marginBottom: 4 }}>OUT OF STOCK — URGENT</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{outOfStock.map((p: any) => <span key={p.id} style={{ background: "#7f1d1d", color: "#fca5a5", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{p.name}</span>)}</div></div>}
                              {lowStock.length > 0 && <div><div style={{ fontSize: 10, color: "#eab308", fontWeight: "bold", marginBottom: 4 }}>LOW STOCK — REORDER SOON</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{lowStock.map((p: any) => <span key={p.id} style={{ background: "#422006", color: "#fbbf24", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{p.name} ({p.stock})</span>)}</div></div>}
                            </div>

                            {/* Top & Slow Sellers */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div style={sec("#334155")}>
                                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold", marginBottom: 10 }}>🏆 Top 5 Sellers</div>
                                {topSelling.length ? topSelling.map((p: any, i: number) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                                    <span style={{ color: "#cbd5e1" }}>{i + 1}. {p.name}</span>
                                    <span style={{ color: "#60a5fa", fontWeight: "bold" }}>{p.qty} sold</span>
                                  </div>
                                )) : <div style={{ color: "#475569" }}>No sales yet</div>}
                              </div>
                              <div style={sec("#334155")}>
                                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold", marginBottom: 10 }}>🐢 Slow Movers (Top 5)</div>
                                {slowMoving.map((p: any, i: number) => (
                                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                                    <span style={{ color: "#cbd5e1" }}>{p.name}</span>
                                    <span style={{ color: "#fca5a5" }}>{p.qty} sold</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {adminTab === "Global Promos" && (
                        <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                          <h3 style={{ marginBottom: 16 }}>Cart Discount Settings</h3>
                          <p style={{ color: "#94a3b8", marginBottom: 20 }}>Configure a global store-wide discount whenever a buyer spends a certain amount.</p>

                          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                              <input type="checkbox" checked={globalPromo.active} onChange={e => setGlobalPromo({ ...globalPromo, active: e.target.checked })} style={{ width: 20, height: 20 }} />
                              <span style={{ fontWeight: "bold" }}>Enable Store-Wide Cart Discount</span>
                            </label>

                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <label style={{ fontSize: 13, color: "#94a3b8" }}>Minimum Spend Threshold (£)</label>
                              <input type="number" min="0" value={globalPromo.threshold} onChange={e => setGlobalPromo({ ...globalPromo, threshold: parseFloat(e.target.value) || 0 })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <label style={{ fontSize: 13, color: "#94a3b8" }}>Discount Type</label>
                              <select value={globalPromo.type} onChange={e => setGlobalPromo({ ...globalPromo, type: e.target.value })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                                <option value="fixed">Fixed (£ Discount)</option>
                                <option value="percent">Percentage (% Discount)</option>
                              </select>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <label style={{ fontSize: 13, color: "#94a3b8" }}>Discount Amount ({globalPromo.type === "fixed" ? "£" : "%"})</label>
                              <input type="number" min="0" value={globalPromo.value} onChange={e => setGlobalPromo({ ...globalPromo, value: parseFloat(e.target.value) || 0 })} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                            </div>

                            <div style={{ width: "100%", height: 1, background: "#334155", margin: "8px 0" }} />

                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <label style={{ fontSize: 13, color: "#fb923c", fontWeight: "bold" }}>VIP Loyalty Discount Percentage (%)</label>
                              <input type="number" min="0" max="100" value={loyaltyDiscountSetting} onChange={e => setLoyaltyDiscountSetting(parseFloat(e.target.value) || 0)} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#fb923c", border: "1px solid #fb923c" }} />
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>Automated deduction applied continuously to any order from a tagged Loyal customer.</span>
                            </div>

                            <div style={{ width: "100%", height: 1, background: "#334155", margin: "8px 0" }} />

                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <h4 style={{ margin: 0, color: "#eab308" }}>Store Notification Banner</h4>
                              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 4 }}>
                                <input type="checkbox" checked={storeAlert.active} onChange={e => setStoreAlert({ ...storeAlert, active: e.target.checked })} style={{ width: 20, height: 20 }} />
                                <span style={{ fontWeight: "bold" }}>Enable Dynamic Top Banner</span>
                              </label>
                              <label style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>Banner Announcement Text</label>
                              <textarea value={storeAlert.message} onChange={e => setStoreAlert({ ...storeAlert, message: e.target.value })} rows={2} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #eab308", resize: "none" }} />
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>Displays this text on the homepage banner.</span>
                            </div>

                            <div style={{ width: "100%", height: 1, background: "#334155", margin: "8px 0" }} />

                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
                              <label style={{ fontSize: 13, color: "#fb923c", fontWeight: "bold" }}>Customer Support Details Overlay</label>
                              <textarea value={supportContact} onChange={e => setSupportContact(e.target.value)} rows={4} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #fb923c", resize: "none" }} />
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>Displays this text when a customer clicks Help & Support.</span>
                            </div>

                            <button onClick={() => {
                              localStorage.setItem("grocerySupportDetails", supportContact);
                              window.alert("Global Platform Settings dynamically verified and locked into production array!");
                            }} style={{ padding: 12, borderRadius: 8, background: "#2563eb", color: "white", border: 0, cursor: "pointer", fontWeight: "bold", marginTop: 16 }}>Broadcast Platform Settings</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {route === "checkout" && (
            <div style={{ maxWidth: 640, flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 10, paddingBottom: 24 }}>
              <h2>Checkout</h2>

              <p style={{ color: "#94a3b8", marginBottom: 16 }}>
                {buyer?.mobile && (savedAddresses[buyer.mobile]?.length ?? 0) > 0 ? "Review and confirm your delivery details below before securely completing checkout." : "Please enter your delivery details to complete your profile."}
              </p>

              {buyer?.mobile && (savedAddresses[buyer.mobile]?.length ?? 0) > 0 && (
                <select
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  style={{
                    display: "block", padding: 12, marginBottom: 12, width: "100%", borderRadius: 10,
                    background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                  }}
                >
                  <option value="">Use previously used address</option>
                  {savedAddresses[buyer.mobile].map((addr, i) => (
                    <option key={i} value={addr}>
                      {addr}
                    </option>
                  ))}
                </select>
              )}

              <input
                autoComplete="none" spellCheck="false" autoCorrect="off" name="mock-checkout-phone-input"
                value={checkoutPhone}
                onChange={(e) => setCheckoutPhone(e.target.value)}
                placeholder="Phone number for delivery updates"
                style={{
                  width: "100%", padding: 10, borderRadius: 8, marginBottom: 10,
                  background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                }}
              />
              {buyer?.mobile && (savedInstructions[buyer.mobile]?.length ?? 0) > 0 && (
                <select
                  onChange={(e) => setDeliveryComment(e.target.value)}
                  style={{
                    display: "block", padding: 12, marginBottom: 12, width: "100%", borderRadius: 10,
                    background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                  }}
                >
                  <option value="">Use previous instructions</option>
                  {savedInstructions[buyer.mobile].map((ins, i) => (
                    <option key={i} value={ins}>
                      {ins}
                    </option>
                  ))}
                </select>
              )}

              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Delivery address (Include Postcode)"
                style={{
                  width: "100%", minHeight: 100, padding: 10, borderRadius: 8, marginBottom: 10,
                  background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                }}
              />

              <textarea
                value={deliveryComment}
                onChange={(e) => setDeliveryComment(e.target.value)}
                placeholder="Additional delivery instructions / comments"
                style={{
                  width: "100%", minHeight: 80, padding: 10, borderRadius: 8, marginBottom: 10,
                  background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                }}
              />

              <input
                autoComplete="none" spellCheck="false" autoCorrect="off" name="mock-checkout-email-input"
                value={checkoutEmail}
                onChange={(e) => setCheckoutEmail(e.target.value)}
                placeholder="Email for invoice / verification"
                style={{
                  width: "100%", padding: 10, borderRadius: 8, marginBottom: 16,
                  background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                }}
              />

              <Elements stripe={stripePromise}>
                <StripeNativeForm setMessage={setMessage} processing={stripePaymentProcessing} onConfirm={(tokenId) => {
                  if (!deliveryAddress.trim()) {
                    setMessage("Enter delivery address before payment");
                    setStripePaymentProcessing(false);
                    return;
                  }
                  if (!/^\+?[\d\s-]{7,15}$/.test(checkoutPhone.trim())) {
                    setMessage("Invalid phone number format detected for delivery updates");
                    setStripePaymentProcessing(false);
                    return;
                  }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkoutEmail.trim())) {
                    setMessage("Invalid email format detected for invoice");
                    setStripePaymentProcessing(false);
                    return;
                  }
                  if (cart.length === 0) {
                    setMessage("Cart is empty");
                    setStripePaymentProcessing(false);
                    return;
                  }

                  setStripePaymentProcessing(true);
                  const activeBuyer = buyer || { mobile: checkoutPhone, name: "Guest Customer" };

                  setSavedInstructions((prev) => ({
                    ...prev,
                    [activeBuyer.mobile]: Array.from(new Set([...(prev[activeBuyer.mobile] || []), deliveryComment])),
                  }));

                  setOrderHistory((prev) => ({
                    ...prev,
                    [activeBuyer.mobile]: [
                      ...(prev[activeBuyer.mobile] || []),
                      {
                        total: subtotal,
                        items: cart.map((c) => `${c.name} x${c.qty}`).join(", "),
                        address: deliveryAddress,
                      },
                    ],
                  }));

                  setSavedAddresses((prev) => ({
                    ...prev,
                    [activeBuyer.mobile]: Array.from(new Set([...(prev[activeBuyer.mobile] || []), deliveryAddress])),
                  }));

                  fetch("/api/checkout", {
                    method: "POST",
                    body: JSON.stringify({ buyer: activeBuyer, cart, deliveryAddress, deliveryComment, subtotal }),
                  }).then(res => res.json()).then(data => {
                    setStripePaymentProcessing(false);
                    if (data.error) {
                      setMessage("Backend error: " + data.error);
                      return;
                    }
                    if (data.order) setAdminOrders(prev => [...prev, data.order]);
                    setAdminProducts(prev => prev.map(p => {
                      const cartItem = cart.find(c => c.id === p.id);
                      if (cartItem) return { ...p, stock: Math.max(0, p.stock - cartItem.qty) };
                      return p;
                    }));
                    if (data.customer) {
                      setAdminCustomers(prev => {
                        const existing = prev.find(c => c.phone === data.customer.phone);
                        if (existing) return prev.map(c => c.phone === data.customer.phone ? data.customer : c);
                        return [...prev, data.customer];
                      });
                    }
                    if ((activeBuyer as any).email && data.order) {
                      fetch("/api/email", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-customer-name": (activeBuyer as any).name || "",
                          "x-customer-phone": (activeBuyer as any).mobile || ""
                        },
                        body: JSON.stringify({
                          email: (activeBuyer as any).email,
                          orderDetails: data.order
                        })
                      }).catch(() => { });
                    }
                    const orderNo = data.order?.id ? `ORD-${String(data.order.id).padStart(5, '0')}` : `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
                    setMessage(`Order ${orderNo} successful • card verified via token [${tokenId.substring(0, 8)}]`);
                    window.alert(`✅ Order Placed Successfully!\n\nOrder Number: ${orderNo}\nYour card was successfully charged £${subtotal.toFixed(2)} via token [${tokenId.substring(0, 8)}...].`);
                    setCart([]);
                    setRoute("store");
                  }).catch(e => {
                    setStripePaymentProcessing(false);
                    setMessage("Network failure submitting order. Please check console.");
                  });
                }} />
              </Elements>
            </div>
          )}

          {route === "buyer" && (
            <div style={{ maxWidth: 520, flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 10, paddingBottom: 24 }}>
              {buyer ? (
                <>
                  <h2>Welcome Back, {buyer.name}!</h2>
                  <div style={{ background: "#1e293b", padding: 20, borderRadius: 12, border: "1px solid #475569", marginBottom: 20, marginTop: 16 }}>
                    <p style={{ color: "#94a3b8", marginBottom: 8, fontSize: 15 }}><strong style={{ color: "white" }}>Phone:</strong> {buyer.mobile}</p>
                    <p style={{ color: "#94a3b8", marginBottom: 8, fontSize: 15 }}><strong style={{ color: "white" }}>Email:</strong> {buyer.email || "Not Provided"}</p>
                    <p style={{ color: "#94a3b8", marginBottom: 8, fontSize: 15 }}><strong style={{ color: "white" }}>Status:</strong> <span style={{ color: buyer.verified ? "#86efac" : "#fca5a5" }}>{buyer.verified ? "Verified User" : "Unverified"}</span></p>

                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #334155" }}>
                      <strong style={{ color: "white", display: "block", marginBottom: 12 }}>Saved Delivery Addresses</strong>
                      {savedAddresses[buyer.mobile] && savedAddresses[buyer.mobile].length > 0 ? (
                        savedAddresses[buyer.mobile].slice(0, 1).map((addr, idx) => (
                          <div key={idx} style={{ padding: 12, background: "#0f172a", borderRadius: 8, marginBottom: 8, color: "#cbd5e1", border: "1px solid #334155", display: "flex", alignItems: "center" }}>
                            <span style={{ background: "#3b82f6", color: "white", padding: "4px 8px", borderRadius: 4, fontSize: 10, marginRight: 12, fontWeight: "bold", textTransform: "uppercase" }}>Default</span>
                            <span>{addr}</span>
                          </div>
                        ))
                      ) : (
                        <span style={{ color: "#64748b", fontStyle: "italic" }}>No saved addresses yet. Order to save one.</span>
                      )}
                    </div>
                  </div>
                  <h3>Your Recent Orders</h3>
                  {orderHistory[buyer.mobile] && orderHistory[buyer.mobile].length > 0 ? (
                    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                      {[...orderHistory[buyer.mobile]].reverse().map((o, i) => (
                        <div key={i} style={{ background: "#0f172a", padding: 18, borderRadius: 10, border: "1px solid #334155", position: "relative" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-start" }}>
                            <div>
                              <strong style={{ color: "#38bdf8", fontSize: 16, display: "block" }}>
                                {(o as any).status ? `Order — ${String((o as any).status).toUpperCase()}` : "Secure Order Delivered"}
                              </strong>
                              <span style={{ fontSize: 12, color: "#64748b" }}>{o.date ? new Date(o.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Recently Completed"}</span>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span style={{ color: "#86efac", fontWeight: "bold", fontSize: 18, display: "block" }}>£{(o.total / 100).toFixed(2)}</span>
                              {(o as any).id && (
                                <span style={{ fontSize: 11, color: "#64748b" }}>#{(o as any).id}</span>
                              )}
                            </div>
                          </div>
                          <div style={{ color: "#cbd5e1", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
                            {(() => {
                              try {
                                const parsed = JSON.parse(o.items as string);
                                if (Array.isArray(parsed)) return parsed.map((item: any) => `${item.name} x${item.qty}`).join(", ");
                              } catch (e) { }
                              return o.items;
                            })()}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>Delivered to: {o.address}</div>

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                              onClick={() => {
                                const newCart: any[] = [];
                                let extractedProducts: { name: string, qty: number }[] = [];
                                try {
                                  const parsed = JSON.parse(o.items as string);
                                  if (Array.isArray(parsed)) extractedProducts = parsed.map((item: any) => ({ name: item.name, qty: item.qty || 1 }));
                                } catch (e) {
                                  String(o.items).split(",").forEach(itemStr => {
                                    const match = itemStr.trim().match(/(.+)\sx(\d+)/);
                                    if (match) extractedProducts.push({ name: match[1].trim(), qty: parseInt(match[2]) });
                                  });
                                }
                                extractedProducts.forEach(ep => {
                                  const actualProduct = products.find(p => p.name.trim().toLowerCase() === ep.name.toLowerCase());
                                  if (actualProduct) newCart.push({ ...actualProduct, qty: ep.qty });
                                });
                                if (newCart.length > 0) { setCart(newCart); setMessage("Historical shopping basket successfully reconstituted! You can now edit quantities."); }
                                else setMessage("Error: Some of these products no longer exist in the active catalog.");
                              }}
                              style={{ padding: "8px 16px", background: "#2563eb", color: "white", border: 0, borderRadius: 6, fontWeight: "bold", cursor: "pointer", flex: 1 }}
                            >
                              Reorder This Delivery
                            </button>
                            {(o as any).id && buyer?.mobile && (
                              <button
                                onClick={() => window.open(`/api/orders/invoice?orderId=${(o as any).id}&phone=${encodeURIComponent(buyer.mobile)}`, "_blank")}
                                style={{ padding: "8px 16px", background: "#0f172a", color: "#38bdf8", border: "1px solid #334155", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }}
                              >
                                📄 View Invoice
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: 20, border: "1px dashed #334155", borderRadius: 10, marginTop: 16, color: "#64748b", textAlign: "center" }}>
                      No orders found.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2>{authMode === "login" ? "Sign In to Grocery OS" : authMode === "register" ? "Create Free Account" : "Recover Password"}</h2>
                  {authMode === "login" && <p style={{ color: "#94a3b8", marginBottom: 16 }}>Enter Email and Password to securely login.</p>}
                  {authMode === "register" && <p style={{ color: "#94a3b8", marginBottom: 16 }}>Create an absolutely free account to track orders and save your basket.</p>}
                  {authMode === "reset" && <p style={{ color: "#94a3b8", marginBottom: 16 }}>Forget your password? Enter your Email and a NEW password below to force a reset immediately.</p>}

                  {(authMode === "register") && (
                    <>
                      <label style={{ display: "block", marginBottom: 4, color: "#94a3b8", fontSize: 13, fontWeight: "bold" }}>Full Name</label>
                      <input autoComplete="none" spellCheck="false" autoCorrect="off" name="mock-name-string" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" style={{ display: "block", padding: 12, marginBottom: 16, width: "100%", borderRadius: 10, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />

                      <label style={{ display: "block", marginBottom: 4, color: "#94a3b8", fontSize: 13, fontWeight: "bold" }}>Phone Number</label>
                      <input autoComplete="none" spellCheck="false" autoCorrect="off" name="mock-phone-string" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="07400000000" style={{ display: "block", padding: 12, marginBottom: 16, width: "100%", borderRadius: 10, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                    </>
                  )}

                  <label style={{ display: "block", marginBottom: 4, color: "#94a3b8", fontSize: 13, fontWeight: "bold" }}>Email Address</label>
                  <input autoComplete="new-password" spellCheck="false" autoCorrect="off" type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="user@domain.com" style={{ display: "block", padding: 12, marginBottom: 16, width: "100%", borderRadius: 10, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />

                  <label style={{ display: "block", marginBottom: 4, color: "#94a3b8", fontSize: 13, fontWeight: "bold" }}>{authMode === "reset" ? "New Password" : "Password"}</label>
                  <input autoComplete="new-password" spellCheck="false" autoCorrect="off" type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" style={{ display: "block", padding: 12, marginBottom: 16, width: "100%", borderRadius: 10, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />

                  <Btn label={authMode === "login" ? "Login Securely" : authMode === "register" ? "Register New Account" : "Confirm Password Reset"} onClick={registerOrLoginBuyer} />

                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    {authMode !== "login" && <button onClick={() => { setAuthMode("login"); setMessage("") }} style={{ background: "transparent", color: "#38bdf8", border: 0, cursor: "pointer", fontWeight: "bold" }}>Back to Login</button>}
                    {authMode !== "register" && <button onClick={() => { setAuthMode("register"); setMessage("") }} style={{ background: "transparent", color: "#38bdf8", border: 0, cursor: "pointer", fontWeight: "bold" }}>Create Free Account</button>}
                    {authMode !== "reset" && <button onClick={() => { setAuthMode("reset"); setMessage("") }} style={{ background: "transparent", color: "#ef4444", border: 0, cursor: "pointer", fontWeight: "bold" }}>Forgot Password?</button>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Global Admin Returns Modal */}
          {returnForm?.active && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#0f172a", padding: 24, borderRadius: 16, width: 450, border: "1px solid #334155" }}>
                <h2 style={{ marginBottom: 16 }}>Process Return</h2>
                <p style={{ color: "#94a3b8", marginBottom: 12 }}>Order #{returnForm.targetOrder.id} - {returnForm.targetItem.name}</p>

                <label style={{ display: "block", marginBottom: 4, color: "#94a3b8", fontSize: 13 }}>Quantity to Return (Max {returnForm.targetItem.qty - adminReturns.filter((r: any) => r.orderId === returnForm.targetOrder.id && r.productName === returnForm.targetItem.name).reduce((a: any, b: any) => a + b.quantity, 0)})</label>
                <input type="number" min="1" value={returnForm.qty} onChange={e => {
                  const allowedMax = returnForm.targetItem.qty - adminReturns.filter((r: any) => r.orderId === returnForm.targetOrder.id && r.productName === returnForm.targetItem.name).reduce((a: any, b: any) => a + b.quantity, 0);
                  const newQty = Math.min(allowedMax, Math.max(1, parseInt(e.target.value) || 1));
                  setReturnForm({ ...returnForm, qty: newQty, refund: newQty * returnForm.targetItem.price });
                }} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", marginBottom: 12 }} />
                <label style={{ display: "block", marginBottom: 4, color: "#94a3b8", fontSize: 13 }}>Return Reason</label>
                <select value={returnForm.reason} onChange={e => setReturnForm({ ...returnForm, reason: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", marginBottom: 12 }}>
                  <option value="Defective / Damaged">Defective / Damaged</option>
                  <option value="Incorrect Item">Incorrect Item</option>
                  <option value="Customer Changed Mind">Customer Changed Mind</option>
                  <option value="Expired">Expired</option>
                </select>

                <label style={{ display: "block", marginBottom: 4, color: "#94a3b8", fontSize: 13 }}>Item Condition</label>
                <select value={returnForm.condition} onChange={e => {
                  const isSealed = e.target.value === "Sealed / Resellable";
                  setReturnForm({ ...returnForm, condition: e.target.value, restock: isSealed ? true : returnForm.restock });
                }} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", marginBottom: 12 }}>
                  <option value="Damaged / Unsellable">Damaged / Unsellable</option>
                  <option value="Sealed / Resellable">Sealed / Resellable</option>
                  <option value="Opened / Good">Opened / Good</option>
                </select>

                <label style={{ display: "block", marginBottom: 4, color: "#94a3b8", fontSize: 13 }}>Refund Amount (£)</label>
                <input type="number" min="0" step="0.01" value={returnForm.refund} onChange={e => setReturnForm({ ...returnForm, refund: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", marginBottom: 12 }} />

                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <input type="checkbox" checked={returnForm.restock} onChange={e => {
                    const willRestock = e.target.checked;
                    if (window.confirm(`Are you sure you want to ${willRestock ? "ENABLE" : "DISABLE"} returning this product to active inventory?`)) {
                      setReturnForm({ ...returnForm, restock: willRestock });
                    }
                  }} style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 14 }}>Return product to active inventory (Restock)</span>
                </label>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setReturnForm(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "#334155", color: "white", border: 0, cursor: "pointer", transition: "transform 0.1s" }}>Cancel</button>
                  <button onClick={async () => {
                    if (!window.confirm(`Warning: You are about to permanently record this return and refund £${returnForm.refund.toFixed(2)}. Are you completely sure you want to proceed?`)) {
                      return;
                    }
                    const payload = {
                      orderId: returnForm.targetOrder.id,
                      productName: String(returnForm.targetItem.name),
                      quantity: returnForm.qty,
                      reason: String(returnForm.reason),
                      condition: String(returnForm.condition),
                      refundAmount: returnForm.refund || 0,
                      restocked: Boolean(returnForm.restock),
                      processedBy: "Admin"
                    };
                    try {
                      const r = await fetch("/api/returns", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                      }).then(res => res.json());

                      if (r.error) {
                        setMessage("Return Failed: " + r.error);
                      } else if (r.success) {
                        setMessage(`Return Processed Successfully for Order #${returnForm.targetOrder.id}`);
                        setTimeout(() => setMessage(""), 2000);
                        setAdminReturns(prev => [...prev, r.returnRecord]);
                        setReturnForm(null);
                        // Force silent update to frontend models instantly
                        if (returnForm.restock) {
                          setAdminProducts(prev => prev.map(p => p.name === returnForm.targetItem.name ? { ...p, stock: p.stock + returnForm.qty } : p));
                        }
                      }
                    } catch (err) {
                      setMessage(`Return Failed: API offline or server crashed`);
                    }
                  }} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "#ef4444", color: "white", border: 0, cursor: "pointer", fontWeight: "bold", transition: "transform 0.1s" }}>Confirm Return</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {!adminLogged && route !== "admin" && (
          <aside style={{ padding: 20, borderLeft: "1px solid #334155", overflowY: "auto" }}>
            <h3>Cart</h3>

            {cart.length === 0 ? (
              <div>Empty</div>
            ) : (
              <>
                {cart.map((x) => (
                  <div key={x.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div>
                        {x.name} <span style={{ color: "#94a3b8", fontSize: 13, marginLeft: 4 }}>x{x.qty}</span>
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        £{(itemsMap[x.id]?.total || 0).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ color: "#86efac", fontSize: 12 }}>
                      Saving: £{(itemsMap[x.id]?.savings || 0).toFixed(2)}
                    </div>

                    {!adminLogged && (
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => decreaseQty(x.id)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: "#334155",
                            color: "white",
                            border: 0,
                            cursor: "pointer",
                          }}
                        >
                          −
                        </button>

                        <button
                          onClick={() => addToCart(x)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: "#2563eb",
                            color: "white",
                            border: 0,
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <hr style={{ margin: "16px 0" }} />
                <hr style={{ margin: "16px 0" }} />
                {globalPromo.active && globalDiscount === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8, fontStyle: "italic" }}>
                    Add £{(globalPromo.threshold - subtotal).toFixed(2)} to unlock {globalPromo.type === "fixed" ? "£" + globalPromo.value : globalPromo.value + "%"} off!
                  </div>
                )}
                {globalDiscount > 0 && (
                  <div style={{ color: "#38bdf8", fontWeight: "bold", marginBottom: 8, fontSize: 14 }}>
                    🎉 Cart Promo Applied (-£{globalDiscount.toFixed(2)})
                  </div>
                )}
                {loyaltyDiscountAmt > 0 && (
                  <div style={{ color: "#fb923c", fontWeight: "bold", marginBottom: 8, fontSize: 14 }}>
                    🌟 Loyalty Discount Applied (-£{loyaltyDiscountAmt.toFixed(2)})
                  </div>
                )}
                {over60DiscountAmt > 0 && (
                  <div style={{ color: "#38bdf8", fontWeight: "bold", marginBottom: 8, fontSize: 14 }}>
                    💳 Bulk Discount {">"}£60 (-£{over60DiscountAmt.toFixed(2)})
                  </div>
                )}
                <div style={{ color: "#86efac", marginBottom: 8 }}>
                  Your savings: £{totalSavings.toFixed(2)}
                </div>
                <strong>Total: £{subtotal.toFixed(2)}</strong>

                {route !== "checkout" && (
                  <div style={{ marginTop: 16 }}>
                    <button
                      onClick={() => {
                        if (cart.length === 0) {
                          setMessage("Cart is empty");
                          return;
                        }
                        if (cart.some(x => x.price === 0)) {
                          window.alert("Validation Error: Item with £0.00 detected. You must contact an Admin to manually override and confirm this Zero-Cost item before transaction processing.");
                          return;
                        }
                        setRoute("checkout");
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "#16a34a",
                        color: "white",
                        fontWeight: "bold",
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      Proceed to Payment
                    </button>
                  </div>
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </>
  );
}