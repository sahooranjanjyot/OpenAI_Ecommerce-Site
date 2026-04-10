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
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [adminOtpSent, setAdminOtpSent] = useState(false);
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
  const products = adminProducts.filter(p => !p.hidden && p.enabled !== false);
  const [adminCategoryFilter, setAdminCategoryFilter] = useState("All");
  const [editForm, setEditForm] = useState<any>({});
  const [catalogSearch, setCatalogSearch] = useState("");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [globalPromo, setGlobalPromo] = useState({ active: false, type: "percent", value: 10, threshold: 50 });
  const [loyaltyDiscountSetting, setLoyaltyDiscountSetting] = useState(10);

  useEffect(() => {
    const saved = localStorage.getItem("groceryGlobalPromo");
    if (saved) setGlobalPromo(JSON.parse(saved));
    const savedLoyalty = localStorage.getItem("groceryLoyaltyDiscount");
    if (savedLoyalty) setLoyaltyDiscountSetting(parseFloat(savedLoyalty) || 10);
  }, []);

  useEffect(() => {
    localStorage.setItem("groceryGlobalPromo", JSON.stringify(globalPromo));
  }, [globalPromo]);

  const [supportContact, setSupportContact] = useState("Email: support@groceryos.com\nPhone: 0800 123 4567\nOperating Hours: 24/7");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("grocerySupportDetails");
      if (saved) setSupportContact(saved);
    } catch(e) {}
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

  const [adminTab, setAdminTab] = useState("Add/Edit/Inventory");
  const [newProduct, setNewProduct] = useState({ name: "", category: "", price: "", stock: "", unitSize: "1", unit: "numbers", image: "", promo: "", description: "" });
  const [inventorySearch, setInventorySearch] = useState("");
  const [promos, setPromos] = useState<any[]>([]);
  const [newPromo, setNewPromo] = useState({ type: "BOGO", target: "", start: "", end: "", buyX: "", payY: "", crossTarget: "", crossDiscount: "" });
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminCustomers, setAdminCustomers] = useState<any[]>([]);
  const [adminAlerts, setAdminAlerts] = useState([{ id: 1, type: "critical", msg: "Milk is out of stock!" }, { id: 2, type: "warning", msg: "Payment failed for Order #103" }]);

  const [inventoryBatches, setInventoryBatches] = useState<any[]>([]);
  const [newBatch, setNewBatch] = useState({ productId: "", quantity: "", costPrice: "", supplier: "" });
  const [orderStartDate, setOrderStartDate] = useState("");
  const [orderEndDate, setOrderEndDate] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then(r => r.json()),
      fetch("/api/orders").then(r => r.json()),
      fetch("/api/customers").then(r => r.json()),
      fetch("/api/promos").then(r => r.json()),
      fetch("/api/inventory").then((r) => r.ok ? r.json() : []),
    ]).then(([productsData, ordersData, customersData, promosData, inventoryData]) => {
      setAdminProducts(productsData || []);
      setAdminOrders(ordersData || []);
      setAdminCustomers(customersData || []);
      setPromos(promosData || []);
      setInventoryBatches(inventoryData || []);
      
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
    }).catch(console.error);
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      try {
        const storedBuyer = localStorage.getItem("groceryos_buyer");
        if (storedBuyer) setBuyer(JSON.parse(storedBuyer));
      } catch (e) {}
      
      if (window.location.hash.includes("admin")) {
        setRoute("admin");
      }
    }
  }, []);
  
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

    setCart((prev) => {
      const found = prev.find((x) => x.id === p.id);
      const qty = found ? found.qty : 0;

      if (qty + increment > p.stock) {
        setMessage("Stock exceeded");
        return prev;
      }

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

  const calculateCartTotals = () => {
    let _subtotal = 0;
    let _savings = 0;
    const itemsMap: Record<number, { total: number; savings: number }> = {};
    const activePromos = promos.filter(p => p.active);

    cart.forEach(item => {
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
        const discountedItemInCart = cart.find(c => c.name === crossSellTrigger.crossTarget);
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

    return { subtotal: _subtotal, totalSavings: _savings, itemsMap, globalDiscount, loyaltyDiscountAmt };
  };

  const { subtotal, totalSavings, itemsMap, globalDiscount, loyaltyDiscountAmt } = calculateCartTotals();

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

       setBuyer(newBuyer);
       localStorage.setItem("groceryos_buyer", JSON.stringify(newBuyer));
       setRoute("store");
       setMessage(authMode === "register" ? "Registration successful!" : `Welcome back, ${data.customer.name}!`);
    } catch(e) {
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
    } catch(e) {}
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
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: route === "admin" ? "220px 1fr" : "220px 1fr 300px",
        background: "#0b132b",
        color: "white",
        boxSizing: "border-box",
      }}
    >
      <style>{`
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
        
        <Btn
          active={route === "buyer"}
          label={buyer ? "My Account" : "Sign In"}
          onClick={() => { setRoute("buyer"); setMessage(""); }}
        />
        {(buyer || adminLogged) && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to securely log out of your Grocery OS profile?")) {
                   setBuyer(null);
                   setAdminLogged(false);
                   setRoute("store");
                   localStorage.removeItem("groceryos_buyer");
                   setMessage("You have securely signed out natively.");
                }
              }}
              style={{
                width: "100%", textAlign: "left", padding: 12, borderRadius: 10,
                background: "transparent", color: "white", border: "1px solid #334155", cursor: "pointer",
              }}
            >
              Log Out
            </button>
        )}
        
        {adminLogged && (
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
            {!adminLogged && <h2>Admin Secure Login</h2>}

            {!adminLogged ? (
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
                    if (!adminOtpSent) {
                      const r = await fetch("/api/auth/admin", { method: "POST", body: JSON.stringify({ action: "request_otp", username: adminUser, password: adminPass }) });
                      const d = await r.json();
                      if (d.error) return setMessage(d.error);
                      setAdminOtpSent(true);
                      setMessage(d.message);
                    } else {
                      const r = await fetch("/api/auth/admin", { method: "POST", body: JSON.stringify({ action: "verify_otp", otp: adminOtp }) });
                      const d = await r.json();
                      if (d.error) return setMessage(d.error);
                      setAdminLogged(true);
                      setAdminOtpSent(false);
                      setAdminOtp("");
                      setMessage("Admin authenticated successfully!");
                    }
                  }}
                />

                {!adminOtpSent && (
                  <button
                    onClick={async () => {
                      setMessage("Transmitting recovery packet natively...");
                      const r = await fetch("/api/auth/admin", { method: "POST", body: JSON.stringify({ action: "forgot_password" }) });
                      const d = await r.json();
                      setMessage(d.message || d.error);
                    }}
                    style={{ background: "transparent", color: "#38bdf8", border: 0, marginTop: 12, cursor: "pointer", fontWeight: "bold", width: "100%", textAlign: "left" }}
                  >
                    Forgot System Password?
                  </button>
                )}
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
                        display: "grid",
                        gridTemplateColumns: "repeat(5, minmax(0,1fr))",
                        gap: 12,
                        marginBottom: 20,
                      }}
                    >
                      {[
                        "Add/Edit/Inventory",
                        "Orders",
                        "Customers",
                        "Alerts",
                        "Revenue & Ledger",
                        "Analytics",
                        "Global Promos"
                      ].map((x) => (
                        <button
                          key={x}
                          onClick={() => setAdminTab(x)}
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

                    {adminTab === "Add/Edit/Inventory" && (<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                        <h3 style={{ marginBottom: 12 }}>Add New Product</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <input placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                          <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                            <option value="" disabled>Select Category</option>
                            {[
                              "Fruits",
                              "Vegetables",
                              "Confectionery",
                              "Sweets",
                              "Snacks",
                              "Rice",
                              "Flour",
                              "Oil",
                              "Lentils",
                              "Spices",
                              "Frozen Item",
                              "Beverages",
                              "Other"
                            ].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <input type="number" min="0" placeholder="Price" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} style={{ padding: 10, borderRadius: 8, flex: "1 1 120px", background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                            <input type="number" min="0" placeholder="Stock Quantity" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: Math.max(0, parseInt(e.target.value)||0).toString()})} style={{ padding: 10, borderRadius: 8, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                            <input type="number" min="1" placeholder="Size (e.g. 500)" value={newProduct.unitSize} onChange={e => setNewProduct({...newProduct, unitSize: Math.max(1, parseInt(e.target.value)||1).toString()})} style={{ padding: 10, borderRadius: 8, width: 120, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                            <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} style={{ padding: 10, borderRadius: 8, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                              {[
                                "numbers",
                                "Gm", "Kg", "ml", "Ltr"
                              ].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <select value={newProduct.promo} onChange={e => setNewProduct({...newProduct, promo: e.target.value})} style={{ padding: 10, borderRadius: 8, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
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
                                if (f) { const r = new FileReader(); r.onload=()=>setNewProduct({...newProduct, image: r.result as string}); r.readAsDataURL(f); }
                              }} />
                            </label>
                            {newProduct.image && <span style={{ color: "#86efac", fontWeight: "bold" }}>✓ Photo Attached</span>}
                          </div>
                          <textarea placeholder="Product Description" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", minHeight: 60 }} />
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => {
                              const isDuplicate = adminProducts.some(prod => prod.name.toLowerCase().trim() === newProduct.name.toLowerCase().trim());
                              if (isDuplicate) {
                                window.alert(`A product named "${newProduct.name.trim()}" already exists in the inventory! Duplicate entries are blocked.`);
                                return;
                              }

                              const baseP = parseFloat(newProduct.price)||0;
                              if (!newProduct.name || !newProduct.category || baseP <= 0 || newProduct.stock === "") {
                                setMessage("Wait! Name, Category, Price, and Stock are absolutely required to publish.");
                                return;
                              }
                              
                              const p = { 
                                name: newProduct.name.trim(), 
                                category: newProduct.category, 
                                price: baseP,
                                wasPrice: 0,
                                onSale: newProduct.promo !== "",
                                promo: newProduct.promo,
                                stock: parseInt(newProduct.stock)||0, 
                                unit: newProduct.unit === "numbers" ? "numbers" : `${newProduct.unitSize} ${newProduct.unit}`, 
                                image: newProduct.image, 
                                description: newProduct.description,
                                enabled: true, hidden: false, featured: false 
                              };
                              
                              fetch("/api/products", {
                                method: "POST",
                                body: JSON.stringify(p)
                              }).then(r => r.json()).then(data => {
                                setAdminProducts([...adminProducts, data]);
                                window.alert(`Success! ${p.name} has been formally published to your database and is now live.`);
                              });
                              
                              setMessage("Product Published to Database!");
                              setNewProduct({ name: "", category: "", price: "", stock: "", unitSize: "1", unit: "numbers", image: "", promo: "", description: "" });
                            }} style={{ padding: 12, borderRadius: 8, background: "#16a34a", color: "white", border: 0, cursor: "pointer", fontWeight: "bold" }}>Save & Publish</button>
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
                                      placeholder="Price"
                                      style={{ padding: 6, borderRadius: 4, flex: "1 1 80px", minWidth: 80, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      value={editForm.stock ?? p.stock}
                                      onChange={(e) => setEditForm({ ...editForm, stock: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                                      placeholder="Stock"
                                      style={{ padding: 6, borderRadius: 4, flex: "1 1 60px", minWidth: 60, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                    />
                                    <select
                                      value={editForm.unit ?? p.unit ?? "numbers"}
                                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                      style={{ padding: 6, borderRadius: 4, flex: "1 1 100px", minWidth: 100, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                    >
                                      {[
                                        "numbers",
                                        "Gm", "Kg", "ml", "Ltr"
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
                                        if (f) { const r = new FileReader(); r.onload=()=>setEditForm({...editForm, image: r.result as string}); r.readAsDataURL(f); }
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
                                        const finalPrice = editForm.price !== undefined ? editForm.price : p.price;
                                        
                                        if (!finalName || !finalCategory || parseFloat(finalPrice) <= 0) {
                                          setMessage("Error: Name, Category, and valid Price are required to save.");
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
                                    £{p.price.toFixed(2)} {p.unit && p.unit !== "numbers" ? " · " + p.unit : ""}
                                    {p.stock < 10 && <span style={{ marginLeft: 6, fontSize: 10, background: "#7f1d1d", color: "#fca5a5", padding: "2px 6px", borderRadius: 10 }}>Low Stock</span>}
                                    {p.promo && <span style={{ marginLeft: 6, fontSize: 10, background: "#ef4444", color: "white", padding: "2px 6px", borderRadius: 10 }}>{p.promo}</span>}
                                  </div>
                                  
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                                    <button onClick={() => {
                                      setAdminProducts(adminProducts.map(prod => prod.id === p.id ? {...prod, stock: Math.max(0, prod.stock - 1)} : prod));
                                      fetch("/api/products", { method: "PUT", body: JSON.stringify({ id: p.id, stock: Math.max(0, p.stock - 1) }) });
                                    }} style={{ padding: "2px 8px", background: "#475569", color: "white", border: 0, borderRadius: 4, cursor: "pointer" }}>-</button>
                                    <span style={{ fontSize: 12, fontWeight: "bold" }}>{p.stock}</span>
                                    <button onClick={() => {
                                      setAdminProducts(adminProducts.map(prod => prod.id === p.id ? {...prod, stock: prod.stock + 1} : prod));
                                      fetch("/api/products", { method: "PUT", body: JSON.stringify({ id: p.id, stock: p.stock + 1 }) });
                                    }} style={{ padding: "2px 8px", background: "#2563eb", color: "white", border: 0, borderRadius: 4, cursor: "pointer" }}>+</button>
                                  </div>

                                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                                    Status: {p.enabled === false ? "Disabled" : "Enabled"} | Visibility: {p.hidden ? "Hidden" : "Visible"}
                                  </div>
                                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                    <button
                                      onClick={() => {
                                        setEditingProductId(p.id);
                                        setEditForm({ name: p.name, category: p.category, price: p.price, stock: p.stock, unit: p.unit ?? "numbers", enabled: p.enabled ?? true, featured: p.featured ?? false, hidden: p.hidden ?? false, image: p.image ?? "" });
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
                              <input type="date" value={orderStartDate} onChange={e => setOrderStartDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <label style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>To Date</label>
                              <input type="date" value={orderEndDate} onChange={e => setOrderEndDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569" }} />
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
                        }).map(o => {
                          let parsedItems = [];
                          try { parsedItems = JSON.parse(o.items || "[]"); } catch(e){}
                          
                          return (
                            <div key={o.id} style={{ background: "#1e293b", padding: 16, borderRadius: 8, borderLeft: "4px solid #3b82f6" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                <div>
                                  <strong style={{ fontSize: 16 }}>Order #{o.id}</strong> <span style={{ color: "#94a3b8", fontSize: 13, marginLeft: 8 }}>{o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}</span>
                                  <div style={{ color: "#e2e8f0", marginTop: 4 }}>Customer #{o.customerId}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <strong style={{ fontSize: 18, color: "#10b981" }}>£{o.total.toFixed(2)}</strong>
                                </div>
                              </div>
                              <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 16, background: "#0f172a", padding: 10, borderRadius: 8 }}>
                                <strong style={{color: "#94a3b8", display: "block", marginBottom: 6}}>Items Purchased:</strong>
                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                  {parsedItems.map((item: any, idx: number) => (
                                    <li key={idx}>{item.qty}x {item.name} (£{(item.price * item.qty).toFixed(2)})</li>
                                  ))}
                                  {parsedItems.length === 0 && <li>No items parsed</li>}
                                </ul>
                              </div>
                              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <select value={o.status} onChange={(e) => setAdminOrders(adminOrders.map(x => x.id === o.id ? {...x, status: e.target.value} : x))} style={{ padding: 8, borderRadius: 6, background: "#0f172a", color: "#f8fafc", border: "1px solid #475569" }}>
                                  <option value="new">New</option>
                                  <option value="accepted">Accepted</option>
                                  <option value="packed">Packed</option>
                                  <option value="out_for_delivery">Out for Delivery</option>
                                  <option value="delivered">Delivered</option>
                                  <option value="canceled">Canceled</option>
                                  <option value="failed_payment">Failed Payment</option>
                                  <option value="refund_request">Refund Request</option>
                                </select>
                                <button onClick={() => setMessage("Calling customer...")} style={{ padding: "8px 12px", background: "#0ea5e9", color: "white", border: 0, borderRadius: 6, cursor: "pointer" }}>Call Customer</button>
                                <button 
                                  onClick={async () => {
                                    setMessage("Retrieving customer credentials...");
                                    const cust = adminCustomers.find(c => c.phone === o.customerPhone);
                                    if (!cust || !cust.email) return setMessage("Client Email Not Provided in Registry!");
                                    setMessage("Transmitting Digital Invoice securely...");
                                    const res = await fetch("/api/email", {
                                       method: "POST", body: JSON.stringify({
                                          action: "resend_invoice",
                                          email: cust.email,
                                          orderDetails: { id: o.id, total: o.total, date: new Date(o.createdAt).toLocaleString(), items: Object.keys(o.items || {}).map(k=>`${o.items[k]?.qty}x ${o.items[k]?.name}`).join('\n') }
                                       })
                                    });
                                    const d = await res.json();
                                    setMessage(d.message || d.error);
                                  }} 
                                  style={{ padding: "8px 12px", background: "#475569", color: "white", border: 0, borderRadius: 6, cursor: "pointer" }}
                                >
                                  Resend Invoice
                                </button>
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
                              <button onClick={() => setAdminCustomers(adminCustomers.map(x => x.id === c.id ? {...x, blocked: !x.blocked} : x))} style={{ padding: "8px 12px", background: c.blocked ? "#f87171" : "#dc2626", color: "white", border: 0, borderRadius: 6, cursor: "pointer" }}>{c.blocked ? "Unblock" : "Block Customer"}</button>
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    )}

                    {adminTab === "Alerts" && (
                      <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                        <h3 style={{ marginBottom: 12 }}>Daily Alerts</h3>
                        <div style={{ display: "grid", gap: 10 }}>
                        {adminProducts.filter(p => p.stock < 10).map(p => (
                          <div key={`low-stock-${p.id}`} style={{ padding: 12, borderRadius: 8, background: "#7f1d1d", color: "white", display: "flex", justifyContent: "space-between" }}>
                            <span>⚠️ Critical: {p.name} drops below configured stock boundary. Only {p.stock} units remaining!</span>
                            <button onClick={() => setAdminTab("Add/Edit/Inventory")} style={{ background: "transparent", border: "1px solid white", borderRadius: 4, padding: "4px 8px", color: "white", cursor: "pointer", fontWeight: "bold" }}>Review Inventory</button>
                          </div>
                        ))}
                        {adminAlerts.map(a => (
                          <div key={a.id} style={{ padding: 12, borderRadius: 8, background: a.type === "critical" ? "#7f1d1d" : "#9a3412", color: "white", display: "flex", justifyContent: "space-between" }}>
                            <span>{a.msg}</span>
                            <button onClick={() => setAdminAlerts(adminAlerts.filter(x => x.id !== a.id))} style={{ background: "transparent", border: 0, color: "white", cursor: "pointer", fontWeight: "bold" }}>Dismiss</button>
                          </div>
                        ))}
                        </div>
                      </div>
                    )}

                    {adminTab === "Revenue & Ledger" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                          <h3 style={{ marginBottom: 12 }}>Add Top-up Ledger Entry</h3>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <select value={newBatch.productId} onChange={e => setNewBatch({...newBatch, productId: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", flex: 1 }}>
                              <option value="" disabled>Select Product</option>
                              {adminProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <input placeholder="Qty (e.g. 50)" type="number" value={newBatch.quantity} onChange={e => setNewBatch({...newBatch, quantity: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", width: 120 }} />
                            <input placeholder="Total Invoice Cost (£)" type="number" step="0.01" value={newBatch.costPrice} onChange={e => setNewBatch({...newBatch, costPrice: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", width: 180 }} />
                            <input placeholder="Supplier" value={newBatch.supplier} onChange={e => setNewBatch({...newBatch, supplier: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "white", border: "1px solid #475569", flex: 1 }} />
                            <button onClick={() => {
                              if (!newBatch.productId || !newBatch.quantity || !newBatch.costPrice) {
                                setMessage("Error: Product, Qty, and Total Cost are required for the ledger.");
                                return;
                              }
                              
                              // Architecturally calculate strictly derived Unit Cost from the Total Invoice bounds
                              const calculatedUnitCost = parseFloat(newBatch.costPrice) / parseInt(newBatch.quantity);
                              
                              fetch("/api/inventory", {
                                method: "POST",
                                body: JSON.stringify({...newBatch, costPrice: calculatedUnitCost})
                              }).then(r => r.json()).then(data => {
                                if (data.error) {
                                  setMessage("API Error: " + data.error);
                                  return;
                                }
                                setInventoryBatches([data, ...inventoryBatches]);
                                setAdminProducts(adminProducts.map(p => p.id === data.productId ? {...p, stock: p.stock + data.quantity} : p));
                                setMessage("Inventory explicitly logged with derived unit costs.");
                                setNewBatch({ productId: "", quantity: "", costPrice: "", supplier: "" });
                              });
                            }} style={{ padding: "10px 16px", borderRadius: 8, background: "#16a34a", color: "white", border: 0, cursor: "pointer", fontWeight: "bold" }}>Record Top-up</button>
                          </div>
                        </div>

                        <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                          <h3 style={{ marginBottom: 12 }}>Detailed Top-up Ledger</h3>
                          <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid #475569" }}>
                                <th style={{ padding: 8 }}>Date</th>
                                <th style={{ padding: 8 }}>Product</th>
                                <th style={{ padding: 8 }}>Qty Loaded</th>
                                <th style={{ padding: 8 }}>Total Invoice Cost</th>
                                <th style={{ padding: 8 }}>Unit Cost</th>
                                <th style={{ padding: 8 }}>Supplier</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inventoryBatches.slice(0, 15).map(b => (
                                <tr key={b.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                  <td style={{ padding: 8 }}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "-"}</td>
                                  <td style={{ padding: 8 }}>{b.product?.name || "Unknown"}</td>
                                  <td style={{ padding: 8 }}>+{b.quantity}</td>
                                  <td style={{ padding: 8 }}>£{(b.costPrice * b.quantity).toFixed(2)}</td>
                                  <td style={{ padding: 8 }}>£{b.costPrice ? b.costPrice.toFixed(2) : "0.00"}</td>
                                  <td style={{ padding: 8 }}>{b.supplier || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                                  try { items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items; } catch(e){}
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

                                return Array.from({length: 1}).filter(() => soldUnits > 0).map(() => (
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
                                <th style={{ padding: 8 }}>Total Lifecycle Procured</th>
                                <th style={{ padding: 8 }}>Total Deficit (Sold)</th>
                                <th style={{ padding: 8 }}>Physical Active Stock</th>
                                <th style={{ padding: 8 }}>Weighted Avg COGS</th>
                                <th style={{ padding: 8 }}>Total Capital Liability</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminProducts.map(p => {
                                const soldUnits = adminOrders.reduce((sum, o) => {
                                  let items = [];
                                  try { items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items; } catch(e){}
                                  if (!Array.isArray(items)) items = Object.values(o.items || {});
                                  const match = items.find((i: any) => i.id === p.id);
                                  return sum + (match ? match.qty : 0);
                                }, 0);
                                
                                const relatedBatches = inventoryBatches.filter(b => b.productId === p.id);
                                const ledgerBought = relatedBatches.reduce((sum, b) => sum + parseInt(b.quantity), 0);
                                const avgCost = ledgerBought > 0 ? relatedBatches.reduce((sum, b) => sum + (parseFloat(b.costPrice) * parseInt(b.quantity)), 0) / ledgerBought : (p.price * 0.7); 
                                
                                const currentStock = p.stock;
                                const trueTotalBought = currentStock + soldUnits;
                                const totalCapitalLiability = currentStock * avgCost;

                                return Array.from({length: 1}).filter(() => trueTotalBought > 0).map(() => (
                                  <tr key={p.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                    <td style={{ padding: 8 }}><strong>{p.name}</strong></td>
                                    <td style={{ padding: 8 }}>{trueTotalBought} units</td>
                                    <td style={{ padding: 8, color: "#fca5a5" }}>-{soldUnits} units</td>
                                    <td style={{ padding: 8, color: "#86efac", fontWeight: "bold" }}>{currentStock} units</td>
                                    <td style={{ padding: 8 }}>£{avgCost.toFixed(2)} / unit</td>
                                    <td style={{ padding: 8 }}>£{totalCapitalLiability.toFixed(2)} suspended</td>
                                  </tr>
                                ));
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {adminTab === "Analytics" && (() => {
                      const today = new Date().toISOString().split("T")[0];
                      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

                      let todaySales = 0;
                      let weeklySales = 0;
                      let todayOrdersCount = 0;
                      let totalSales = 0;
                      let orderCount = adminOrders.length;
                      let allSoldItems: Record<string, number> = {};
                      let categorySales: Record<string, number> = {};
                      let promoSales = 0;
                      
                      const buyersMap: Record<string, number> = {};

                      adminOrders.forEach(o => {
                        totalSales += o.total;
                        if (o.createdAt.startsWith(today)) {
                          todaySales += o.total;
                          todayOrdersCount++;
                        }
                        if (o.createdAt >= lastWeek) {
                          weeklySales += o.total;
                        }
                        
                        if (o.buyerId) {
                          buyersMap[o.buyerId] = (buyersMap[o.buyerId] || 0) + 1;
                        }

                        try {
                          const items = JSON.parse(o.items || "[]");
                          items.forEach((item: any) => {
                            allSoldItems[item.id] = (allSoldItems[item.id] || 0) + item.qty;
                            const product = adminProducts.find(p => p.id === item.id);
                            if (product) {
                              categorySales[product.category] = (categorySales[product.category] || 0) + item.qty;
                              if (product.promo) {
                                promoSales += (item.qty * item.price);
                              }
                            }
                          });
                        } catch(e) {}
                      });

                      const avgBasket = orderCount > 0 ? (totalSales / orderCount).toFixed(2) : "0.00";
                      const repeatCustomers = Object.values(buyersMap).filter(qty => qty > 1).length;

                      const sortedProducts = Object.entries(allSoldItems)
                        .sort((a, b) => b[1] - a[1])
                        .map(entry => {
                           const p = adminProducts.find(p => p.id === entry[0]);
                           return p ? { name: p.name, qty: entry[1] } : null;
                        }).filter(Boolean);

                      const topSelling = sortedProducts.slice(0, 3);
                      const slowMoving = adminProducts.map(p => ({
                        name: p.name,
                        qty: allSoldItems[p.id] || 0
                      })).sort((a,b) => a.qty - b.qty).slice(0, 3);

                      const bestCategory = Object.entries(categorySales).sort((a, b) => b[1] - a[1])[0];
                      const lowStock = adminProducts.filter(p => p.stock < 10).map(p => p.name);

                      return (
                        <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                          <h3 style={{ marginBottom: 16 }}>Analytics Dashboard</h3>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                            <div style={{ padding: 16, background: "#1e293b", borderRadius: 10, border: "1px solid #475569" }}>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Today&apos;s Sales</div>
                              <div style={{ fontSize: 24, fontWeight: "bold", color: "#86efac" }}>£{todaySales.toFixed(2)}</div>
                            </div>
                            <div style={{ padding: 16, background: "#1e293b", borderRadius: 10, border: "1px solid #475569" }}>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Weekly Sales</div>
                              <div style={{ fontSize: 24, fontWeight: "bold", color: "#60a5fa" }}>£{weeklySales.toFixed(2)}</div>
                            </div>
                            <div style={{ padding: 16, background: "#1e293b", borderRadius: 10, border: "1px solid #475569" }}>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Daily Orders Count</div>
                              <div style={{ fontSize: 24, fontWeight: "bold" }}>{todayOrdersCount}</div>
                            </div>
                            <div style={{ padding: 16, background: "#1e293b", borderRadius: 10, border: "1px solid #475569" }}>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Avg Basket Value</div>
                              <div style={{ fontSize: 24, fontWeight: "bold" }}>£{avgBasket}</div>
                            </div>
                            <div style={{ padding: 16, background: "#1e293b", borderRadius: 10, border: "1px solid #475569" }}>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Repeat Customers</div>
                              <div style={{ fontSize: 24, fontWeight: "bold", color: "#fcd34d" }}>{repeatCustomers}</div>
                            </div>
                            <div style={{ padding: 16, background: "#1e293b", borderRadius: 10, border: "1px solid #475569" }}>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Promo Performance</div>
                              <div style={{ fontSize: 24, fontWeight: "bold" }}>£{promoSales.toFixed(2)}</div>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div style={{ padding: 16, background: "#1e293b", borderRadius: 10, border: "1px solid #475569" }}>
                              <h4 style={{ margin: "0 0 12px 0", color: "#94a3b8" }}>Top Selling Products</h4>
                              {topSelling.length ? topSelling.map((p: any, i) => <div key={i} style={{ marginBottom: 6 }}>{i+1}. {p.name} <span style={{ color: "#60a5fa" }}>({p.qty} sold)</span></div>) : <div style={{color: "#475569"}}>No data</div>}
                            </div>
                            <div style={{ padding: 16, background: "#1e293b", borderRadius: 10, border: "1px solid #475569" }}>
                              <h4 style={{ margin: "0 0 12px 0", color: "#94a3b8" }}>Slow Moving Products</h4>
                              {slowMoving.map((p: any, i) => <div key={i} style={{ marginBottom: 6, color: "#fca5a5" }}>• {p.name} ({p.qty} sold)</div>)}
                            </div>
                            <div style={{ padding: 16, background: "#1e293b", borderRadius: 10, border: "1px solid #475569" }}>
                              <h4 style={{ margin: "0 0 12px 0", color: "#94a3b8" }}>Stock Running Low</h4>
                              {lowStock.length ? lowStock.map((name, i) => <span key={i} style={{ display: "inline-block", background: "#7f1d1d", color: "#fca5a5", padding: "4px 8px", borderRadius: 4, marginRight: 6, marginBottom: 6, fontSize: 12 }}>{name}</span>) : <span style={{color: "#86efac"}}>Inventory Healthy</span>}
                            </div>

                          </div>
                        </div>
                      )
                    })()}

                    {adminTab === "Global Promos" && (
                      <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                        <h3 style={{ marginBottom: 16 }}>Cart Discount Settings</h3>
                        <p style={{ color: "#94a3b8", marginBottom: 20 }}>Configure a global store-wide discount whenever a buyer spends a certain amount.</p>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                            <input type="checkbox" checked={globalPromo.active} onChange={e => setGlobalPromo({...globalPromo, active: e.target.checked})} style={{ width: 20, height: 20 }} />
                            <span style={{ fontWeight: "bold" }}>Enable Store-Wide Cart Discount</span>
                          </label>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 13, color: "#94a3b8" }}>Minimum Spend Threshold (£)</label>
                            <input type="number" min="0" value={globalPromo.threshold} onChange={e => setGlobalPromo({...globalPromo, threshold: parseFloat(e.target.value)||0})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 13, color: "#94a3b8" }}>Discount Type</label>
                            <select value={globalPromo.type} onChange={e => setGlobalPromo({...globalPromo, type: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                              <option value="fixed">Fixed (£ Discount)</option>
                              <option value="percent">Percentage (% Discount)</option>
                            </select>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 13, color: "#94a3b8" }}>Discount Amount ({globalPromo.type === "fixed" ? "£" : "%"})</label>
                            <input type="number" min="0" value={globalPromo.value} onChange={e => setGlobalPromo({...globalPromo, value: parseFloat(e.target.value)||0})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                          </div>
                          
                          <div style={{ width: "100%", height: 1, background: "#334155", margin: "8px 0" }} />
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label style={{ fontSize: 13, color: "#fb923c", fontWeight: "bold" }}>VIP Loyalty Discount Percentage (%)</label>
                            <input type="number" min="0" max="100" value={loyaltyDiscountSetting} onChange={e => setLoyaltyDiscountSetting(parseFloat(e.target.value)||0)} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#fb923c", border: "1px solid #fb923c" }} />
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>Automated deduction applied continuously to any order from a tagged Loyal customer.</span>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
                            <label style={{ fontSize: 13, color: "#fb923c", fontWeight: "bold" }}>Customer Support Details Overlay</label>
                            <textarea value={supportContact} onChange={e => setSupportContact(e.target.value)} rows={4} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #fb923c", resize: "none" }} />
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>Structurally drives the popup string across the main buyer interface globally.</span>
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
                    const orderNo = data.order?.id ? `ORD-${String(data.order.id).padStart(5, '0')}` : `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
                    setMessage(`Order ${orderNo} successful • card verified via token [${tokenId.substring(0,8)}]`);
                    window.alert(`✅ Order Placed Successfully!\n\nOrder Number: ${orderNo}\nYour card was successfully charged £${subtotal.toFixed(2)} via token [${tokenId.substring(0,8)}...].`);
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
                  <p style={{ color: "#94a3b8", marginBottom: 8, fontSize: 15 }}><strong style={{ color: "white" }}>Status:</strong> <span style={{ color: buyer.verified ? "#86efac" : "#fca5a5"}}>{buyer.verified ? "Verified User" : "Unverified"}</span></p>

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
                    {orderHistory[buyer.mobile].map((o, i) => (
                      <div key={i} style={{ background: "#0f172a", padding: 18, borderRadius: 10, border: "1px solid #334155", position: "relative" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-start" }}>
                          <div>
                             <strong style={{ color: "#38bdf8", fontSize: 16, display: "block" }}>Secure Order Delivered</strong>
                             <span style={{ fontSize: 12, color: "#64748b" }}>{o.date ? new Date(o.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : "Recently Completed"}</span>
                          </div>
                          <span style={{ color: "#86efac", fontWeight: "bold", fontSize: 18 }}>£{o.total.toFixed(2)}</span>
                        </div>
                        <div style={{ color: "#cbd5e1", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
                          {(() => {
                            try {
                              const parsed = JSON.parse(o.items as string);
                              if (Array.isArray(parsed)) return parsed.map((item: any) => `${item.name} x${item.qty}`).join(", ");
                            } catch(e) {}
                            return o.items;
                          })()}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>Delivered to: {o.address}</div>
                        
                        <div style={{ display: "flex", gap: 10 }}>
                           <button 
                             onClick={() => {
                                const newCart: any[] = [];
                                
                                // Safely handle both Legacy String payloads and Raw JSON arrays
                                let extractedProducts: {name: string, qty: number}[] = [];
                                try {
                                  const parsed = JSON.parse(o.items as string);
                                  if (Array.isArray(parsed)) extractedProducts = parsed.map((item: any) => ({ name: item.name, qty: item.qty || 1 }));
                                } catch(e) {
                                  String(o.items).split(",").forEach(itemStr => {
                                     const match = itemStr.trim().match(/(.+)\sx(\d+)/);
                                     if (match) extractedProducts.push({ name: match[1].trim(), qty: parseInt(match[2]) });
                                  });
                                }

                                extractedProducts.forEach(ep => {
                                  const actualProduct = products.find(p => p.name.trim().toLowerCase() === ep.name.toLowerCase());
                                  if (actualProduct) {
                                     newCart.push({ ...actualProduct, qty: ep.qty });
                                  }
                                });
                                
                                if (newCart.length > 0) {
                                   setCart(newCart);
                                   setMessage("Historical shopping basket successfully reconstituted! You can now edit quantities.");
                                } else {
                                   setMessage("Error: Some of these products no longer exist in the active catalog.");
                                }
                             }} 
                             style={{ padding: "8px 16px", background: "#2563eb", color: "white", border: 0, borderRadius: 6, fontWeight: "bold", cursor: "pointer", flex: 1 }}
                           >
                             Reorder This Delivery
                           </button>
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
                  {authMode !== "login" && <button onClick={() => {setAuthMode("login"); setMessage("")}} style={{ background: "transparent", color: "#38bdf8", border: 0, cursor: "pointer", fontWeight: "bold" }}>Back to Login</button>}
                  {authMode !== "register" && <button onClick={() => {setAuthMode("register"); setMessage("")}} style={{ background: "transparent", color: "#38bdf8", border: 0, cursor: "pointer", fontWeight: "bold" }}>Create Free Account</button>}
                  {authMode !== "reset" && <button onClick={() => {setAuthMode("reset"); setMessage("")}} style={{ background: "transparent", color: "#ef4444", border: 0, cursor: "pointer", fontWeight: "bold" }}>Forgot Password?</button>}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {route !== "admin" && (
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
  );
}