"use client";

import React, { useMemo, useState } from "react";

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
  verified: boolean;
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
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryComment, setDeliveryComment] = useState("");
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<Record<string, string[]>>({});
  const [savedInstructions, setSavedInstructions] = useState<Record<string, string[]>>({});
  const [orderHistory, setOrderHistory] = useState<Record<string, { total: number; items: string; address: string }[]>>({});
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [paymentOtpSent, setPaymentOtpSent] = useState(false);
  const [paymentOtp, setPaymentOtp] = useState("");
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [adminProducts, setAdminProducts] = useState<(Product & { enabled?: boolean; featured?: boolean; hidden?: boolean; image?: string; unit?: string })[]>(
    productsSeed.map((p) => ({ ...p, enabled: true, featured: false, hidden: false, image: "", unit: "numbers" }))
  );
  const products = adminProducts.filter(p => !p.hidden && p.enabled !== false);
  const [adminCategoryFilter, setAdminCategoryFilter] = useState("All");
  const [editForm, setEditForm] = useState<any>({});
  const [catalogSearch, setCatalogSearch] = useState("");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  const [adminTab, setAdminTab] = useState("Catalog");
  const [newProduct, setNewProduct] = useState({ name: "", category: "", price: "", stock: "", unit: "numbers", image: "", discount: "0", description: "" });
  const [inventorySearch, setInventorySearch] = useState("");
  const [promos, setPromos] = useState([{ id: 1, type: "BOGO", target: "Potato Chips", active: true, start: "2026-04-01", end: "2026-04-15" }]);
  const [newPromo, setNewPromo] = useState({ type: "BOGO", target: "", start: "", end: "" });
  const [adminOrders, setAdminOrders] = useState([{ id: 101, customer: "Mrs Smith", status: "new", total: 12.5, items: "Bananas x2, Milk x1", phone: "1234567890" }, { id: 102, customer: "John Doe", status: "delivered", total: 4.5, items: "Basmati Rice x1", phone: "0987654321" }]);
  const [adminCustomers, setAdminCustomers] = useState([{ id: 1, name: "Mrs Smith", phone: "1234567890", address: "10 Downing St", orders: 5, notes: "orders rice every week", blocked: false }]);
  const [adminAlerts, setAdminAlerts] = useState([{ id: 1, type: "critical", msg: "Milk is out of stock!" }, { id: 2, type: "warning", msg: "Payment failed for Order #103" }]);

  const visible = useMemo(() => {
    let list = route === "sale" ? products.filter((p) => p.onSale) : products;

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

  const getLineTotal = (item: Product & { qty: number }) => {
    if (item.promo === "BOGO") {
      const payableQty = Math.ceil(item.qty / 2);
      return payableQty * item.price;
    }
    if (item.promo === "4 for 3") {
      const bundles = Math.floor(item.qty / 4);
      const remainder = item.qty % 4;
      return bundles * (3 * item.price) + remainder * item.price;
    }
    return item.qty * item.price;
  };

  const getLineSavings = (item: Product & { qty: number }) => {
    if (item.promo === "BOGO") {
      return Math.floor(item.qty / 2) * item.price;
    }
    if (item.promo === "4 for 3") {
      return Math.floor(item.qty / 4) * item.price;
    }
    if (item.wasPrice && item.wasPrice > item.price) {
      return item.qty * (item.wasPrice - item.price);
    }
    return 0;
  };

  const subtotal = cart.reduce((s, x) => s + getLineTotal(x), 0);
  const totalSavings = cart.reduce((s, x) => s + getLineSavings(x), 0);

  const registerOrLoginBuyer = () => {
    if (!mobile) {
      setMessage("Enter mobile");
      return;
    }

    if (!buyer) {
      if (!name) {
        setMessage("Enter name for first registration");
        return;
      }
      setOtpSent(true);
      setMessage("OTP sent: use 123456");
      return;
    }

    if (buyer.mobile === mobile) {
      setMessage(`Welcome back ${buyer.name}`);
      setRoute("store");
    } else {
      setMessage("Mobile number does not match registered buyer");
    }
  };

  const verifyOtp = () => {
    if (otp !== "123456") {
      setMessage("Invalid OTP");
      return;
    }

    const newBuyer: Buyer = {
      name,
      mobile,
      verified: true,
    };

    setBuyer(newBuyer);
    setOtpSent(false);
    setOtp("");
    setMessage(`Buyer ${name} verified successfully`);
    setRoute("store");
  };

  const Btn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: "#2563eb",
        color: "white",
        border: 0,
        cursor: "pointer",
        marginBottom: 10,
        width: "100%",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "220px 1fr 300px",
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
      `}</style>

      <aside style={{ padding: 20, borderRight: "1px solid #334155", overflowY: "auto" }}>
        <h3>🛒 Grocery OS</h3>

        <Btn
          label={productsExpanded ? "Products ▼" : "Products ▶"}
          onClick={() => {
            setRoute("store");
            setSelectedCategory("All");
            setProductsExpanded((v) => !v);
          }}
        />

        {productsExpanded && (
          <div style={{ margin: "6px 0 14px 0", display: "grid", gap: 6 }}>
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
                  setSelectedCategory(cat);
                }}
                style={{
                  textAlign: "left",
                  background: selectedCategory === cat ? "#1d4ed8" : "transparent",
                  color: "#cbd5e1",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <Btn label="Sale" onClick={() => setRoute("sale")} />
        <Btn
          label={buyer ? `Buyer: ${buyer.name}` : "Buyer Login"}
          onClick={() => setRoute("buyer")}
        />
        <Btn
          label={adminLogged ? "Admin Logged In" : "Admin Login"}
          onClick={() => setRoute("admin")}
        />
      </aside>

      <main style={{ padding: 24, paddingBottom: 0, height: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden" }}>
        {message && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              border: "1px solid #334155",
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
              <button
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#2563eb",
                  color: "white",
                  border: 0,
                }}
              >
                Search
              </button>
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

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                paddingRight: 8,
                paddingBottom: 24,
                alignContent: "start",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
              {visible.map((p) => (
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
                  <div
                    style={{
                      height: 60,
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

                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  <div style={{ color: "#94a3b8", marginBottom: 2 }}>{p.category} • Stock: {p.stock}</div>

                  <div style={{ marginBottom: 4 }}>
                    {!(p.promo === "BOGO" || p.promo === "4 for 3") &&
                      p.wasPrice && (
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

                  {p.promo && <div style={{ color: "#86efac", fontWeight: 600 }}>{p.promo}</div>}
                  {p.promo === "BOGO" && (
                    <div style={{ fontSize: 11, color: "#93c5fd" }}>Buy 1, get 1 free</div>
                  )}
                  {p.promo === "4 for 3" && (
                    <div style={{ fontSize: 11, color: "#93c5fd" }}>Every 4th item free</div>
                  )}

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
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {route === "admin" && (
          <div style={{ maxWidth: 720, flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 10, paddingBottom: 24 }}>
            <h2>Admin Secure Login</h2>

            {!adminLogged ? (
              <>
                <input
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  placeholder="Admin User ID"
                  style={{
                    display: "block",
                    padding: 12,
                    marginBottom: 12,
                    width: 420,
                  }}
                />
                <input
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="Password"
                  style={{
                    display: "block",
                    padding: 12,
                    marginBottom: 12,
                    width: 420,
                  }}
                />
                <input
                  value={adminOtp}
                  onChange={(e) => setAdminOtp(e.target.value)}
                  placeholder="OTP (123456)"
                  style={{
                    display: "block",
                    padding: 12,
                    marginBottom: 12,
                    width: 420,
                  }}
                />

                <Btn
                  label="Login Admin"
                  onClick={() => {
                    if (adminUser && adminPass && adminOtp === "123456") {
                      setAdminLogged(true);
                      setMessage("Admin authenticated successfully");
                    } else {
                      setMessage("Invalid admin credentials or OTP");
                    }
                  }}
                />
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>Admin logged in.</div>

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
                        gridTemplateColumns: "repeat(4, minmax(0,1fr))",
                        gap: 12,
                        marginBottom: 20,
                      }}
                    >
                      {[
                        "Catalog",
                        "Add Product",
                        "Inventory Update",
                        "Promo Engine",
                        "Orders",
                        "Customers",
                        "Alerts",
                        "Analytics",
                      ].map((x) => (
                        <button
                          key={x}
                          onClick={() => setAdminTab(x)}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            background: adminTab === x ? "#1d4ed8" : "#2563eb",
                            color: "white",
                            border: 0,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {x}
                        </button>
                      ))}
                    </div>

                    {adminTab === "Catalog" && (
                    <div
                      style={{
                        padding: 16,
                        border: "1px solid #334155",
                        borderRadius: 12,
                      }}
                    >
                      <h3 style={{ marginBottom: 12 }}>Catalog & Product Management</h3>

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
                          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                          gap: 10,
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
                                border: "1px solid #334155",
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
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                      type="number"
                                      min="0"
                                      value={editForm.price ?? p.price}
                                      onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                                      placeholder="Price"
                                      style={{ padding: 6, borderRadius: 4, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      value={editForm.stock ?? p.stock}
                                      onChange={(e) => setEditForm({ ...editForm, stock: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                                      placeholder="Stock"
                                      style={{ padding: 6, borderRadius: 4, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                    />
                                    <select
                                      value={editForm.unit ?? p.unit ?? "numbers"}
                                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                      style={{ padding: 6, borderRadius: 4, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                    >
                                      {[
                                        "numbers",
                                        "100 Gm", "200 Gm", "300 Gms", "400 Gms", "500 Gms", "600 Gms", "700 Gms", "800 Gms", "900 Gms",
                                        "1 KG", "2 KG", "3 KG", "4 KG", "5 KG", "6 KG", "7 KG", "8 KG", "9 KG", "10 KG", "20 KG",
                                        "1 Ltr", "2 Ltr", "3 Ltr", "4 Ltr", "5 Ltrs"
                                      ].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                  </div>
                                  <input
                                    type="text"
                                    value={editForm.image ?? p.image ?? ""}
                                    onChange={(e) => setEditForm({ ...editForm, image: e.target.value })}
                                    placeholder="Image URL"
                                    style={{ padding: 6, borderRadius: 4, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
                                  />
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
                                        setAdminProducts(adminProducts.map(prod => prod.id === p.id ? { ...prod, ...editForm } : prod));
                                        setEditingProductId(null);
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
                                  {p.image && <img src={p.image} alt={p.name} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, marginBottom: 8 }} />}
                                  <div>
                                    <strong>{p.name}</strong>
                                    {p.featured && <span style={{ marginLeft: 6, fontSize: 10, background: "#eab308", color: "black", padding: "2px 6px", borderRadius: 10 }}>Featured</span>}
                                  </div>
                                  <div>{p.category}</div>
                                  <div>
                                    £{p.price.toFixed(2)} · Stock {p.stock} {p.unit && p.unit !== "numbers" ? p.unit : ""}
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
                                      onClick={() => setAdminProducts(adminProducts.filter(prod => prod.id !== p.id))}
                                      style={{ padding: "6px 10px", borderRadius: 8, background: "#dc2626", color: "white", border: 0, cursor: "pointer" }}
                                    >Delete</button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                    )}

                    {adminTab === "Add Product" && (
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
                            <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} style={{ padding: 10, borderRadius: 8, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                              {[
                                "numbers",
                                "100 Gm", "200 Gm", "300 Gms", "400 Gms", "500 Gms", "600 Gms", "700 Gms", "800 Gms", "900 Gms",
                                "1 KG", "2 KG", "3 KG", "4 KG", "5 KG", "6 KG", "7 KG", "8 KG", "9 KG", "10 KG", "20 KG",
                                "1 Ltr", "2 Ltr", "3 Ltr", "4 Ltr", "5 Ltrs"
                              ].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <select value={newProduct.discount} onChange={e => setNewProduct({...newProduct, discount: e.target.value})} style={{ padding: 10, borderRadius: 8, flex: 1, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                              <option value="0">No Discount</option>
                              <option value="10">10% Off</option>
                              <option value="20">20% Off</option>
                              <option value="30">30% Off</option>
                              <option value="40">40% Off</option>
                              <option value="50">50% Off</option>
                              <option value="60">60% Off</option>
                            </select>
                          </div>
                          <input placeholder="Image URL" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                          <textarea placeholder="Product Description" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", minHeight: 60 }} />
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => {
                              const baseP = parseFloat(newProduct.price)||0;
                              const discP = parseInt(newProduct.discount)||0;
                              const p = { 
                                id: Date.now(), 
                                name: newProduct.name, 
                                category: newProduct.category, 
                                price: discP > 0 ? baseP * (1 - discP/100) : baseP,
                                wasPrice: discP > 0 ? baseP : 0,
                                onSale: discP > 0,
                                stock: parseInt(newProduct.stock)||0, 
                                unit: newProduct.unit, 
                                image: newProduct.image, 
                                enabled: true, hidden: false, featured: false 
                              };
                              setAdminProducts([...adminProducts, p]);
                              setMessage("Product Published Instantly!");
                              setNewProduct({ name: "", category: "", price: "", stock: "", unit: "numbers", image: "", discount: "0", description: "" });
                            }} style={{ padding: 12, borderRadius: 8, background: "#16a34a", color: "white", border: 0, cursor: "pointer", fontWeight: "bold" }}>Save & Publish</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {adminTab === "Inventory Update" && (
                      <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                        <h3 style={{ marginBottom: 12 }}>Stock Management</h3>
                        <input placeholder="Search Inventory..." value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} style={{ padding: 10, borderRadius: 8, width: "100%", marginBottom: 12, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }} />
                        <div style={{ display: "grid", gap: 10 }}>
                        {adminProducts.filter(p => p.name.toLowerCase().includes(inventorySearch.toLowerCase())).map(p => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e293b", padding: 12, borderRadius: 8, flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <strong>{p.name}</strong> 
                              {p.stock < 10 && <span style={{ marginLeft: 8, color: "#f87171", fontSize: 12 }}>Low Stock!</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14 }}>Current: {p.stock}</span>
                              <button onClick={() => setAdminProducts(adminProducts.map(prod => prod.id === p.id ? {...prod, stock: Math.max(0, prod.stock - 1)} : prod))} style={{ padding: "4px 10px", background: "#475569", color: "white", border: 0, borderRadius: 4, cursor: "pointer" }}>-</button>
                              <button onClick={() => setAdminProducts(adminProducts.map(prod => prod.id === p.id ? {...prod, stock: prod.stock + 1} : prod))} style={{ padding: "4px 10px", background: "#2563eb", color: "white", border: 0, borderRadius: 4, cursor: "pointer" }}>+</button>
                              <button onClick={() => setAdminProducts(adminProducts.map(prod => prod.id === p.id ? {...prod, stock: 0} : prod))} style={{ padding: "4px 10px", background: "#dc2626", color: "white", border: 0, borderRadius: 4, cursor: "pointer" }}>Out of Stock</button>
                              <button onClick={() => setAdminProducts(adminProducts.map(prod => prod.id === p.id ? {...prod, stock: prod.stock + 50} : prod))} style={{ padding: "4px 10px", background: "#16a34a", color: "white", border: 0, borderRadius: 4, cursor: "pointer" }}>Restock (+50)</button>
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    )}

                    {adminTab === "Promo Engine" && (
                      <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                        <h3 style={{ marginBottom: 12 }}>Promo Engine</h3>
                        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                          <select value={newPromo.type} onChange={e => setNewPromo({...newPromo, type: e.target.value, target: e.target.value === "Weekend Sale" ? "All Store" : ""})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", flex: "1 1 120px" }}>
                            <option>BOGO</option>
                            <option>Discount %</option>
                            <option>Flat Price Drop</option>
                            <option>Weekend Sale</option>
                            <option>Category-wide Sale</option>
                            <option>Product-specific Sale</option>
                          </select>
                          
                          {newPromo.type === "Category-wide Sale" ? (
                            <select value={newPromo.target} onChange={e => setNewPromo({...newPromo, target: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", flex: 1 }}>
                              <option value="" disabled>Select Category</option>
                              {Array.from(new Set(adminProducts.map(p => p.category))).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : newPromo.type === "Weekend Sale" ? (
                            <select value={newPromo.target} onChange={e => setNewPromo({...newPromo, target: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", flex: 1 }}>
                              <option value="All Store">All Store</option>
                            </select>
                          ) : (
                            <select value={newPromo.target} onChange={e => setNewPromo({...newPromo, target: e.target.value})} style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", flex: 1 }}>
                              <option value="" disabled>Select Product</option>
                              {adminProducts.map(p => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                              ))}
                            </select>
                          )}

                          <input 
                            type="date" 
                            value={newPromo.start} 
                            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]}
                            onChange={e => setNewPromo({...newPromo, start: e.target.value})} 
                            onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
                            onDoubleClick={e => e.currentTarget.blur()}
                            style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", colorScheme: "dark" }} 
                          />
                          <input 
                            type="date" 
                            value={newPromo.end} 
                            min={newPromo.start || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]}
                            onChange={e => setNewPromo({...newPromo, end: e.target.value})} 
                            onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
                            onDoubleClick={e => e.currentTarget.blur()}
                            style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", colorScheme: "dark" }} 
                          />
                          
                          <button onClick={() => {
                            if (!newPromo.target) {
                              setMessage("Please select a target for your promo!");
                              return;
                            }
                            if (!newPromo.start || !newPromo.end) {
                              setMessage("Please select valid promo start and end dates.");
                              return;
                            }
                            
                            const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
                            if (newPromo.start < localToday) {
                              setMessage("Promo start date cannot be in the past!");
                              return;
                            }
                            if (newPromo.end < newPromo.start) {
                              setMessage("Promo end date cannot be earlier than its start date!");
                              return;
                            }
                            
                            setPromos([...promos, { id: Date.now(), ...newPromo, active: true }]);
                            setMessage(`Promo on ${newPromo.target} successfully activated!`);
                            setNewPromo({ type: "BOGO", target: "", start: "", end: "" });
                          }} style={{ padding: "10px 16px", background: "#2563eb", color: "white", border: 0, borderRadius: 8, cursor: "pointer" }}>Add Promo</button>
                        </div>
                        
                        <div style={{ display: "grid", gap: 10 }}>
                        {promos.map(pr => (
                          <div key={pr.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e293b", padding: 12, borderRadius: 8, flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <strong style={{ color: "#86efac" }}>{pr.type}</strong> on {pr.target} <br/>
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>{pr.start} to {pr.end}</span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => setPromos(promos.map(x => x.id === pr.id ? {...x, active: !x.active} : x))} style={{ padding: "6px 12px", background: pr.active ? "#16a34a" : "#475569", border: 0, color: "white", borderRadius: 4, cursor: "pointer" }}>{pr.active ? "Active" : "Disabled"}</button>
                              <button onClick={() => setPromos(promos.filter(x => x.id !== pr.id))} style={{ padding: "6px 12px", background: "#dc2626", border: 0, color: "white", borderRadius: 4, cursor: "pointer" }}>Delete</button>
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    )}

                    {adminTab === "Orders" && (
                      <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                        <h3 style={{ marginBottom: 12 }}>Order Management</h3>
                        <div style={{ display: "grid", gap: 12 }}>
                        {adminOrders.map(o => (
                          <div key={o.id} style={{ background: "#1e293b", padding: 16, borderRadius: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                              <strong>Order #{o.id} - {o.customer}</strong>
                              <strong>£{o.total.toFixed(2)}</strong>
                            </div>
                            <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 12 }}>Items: {o.items}</div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <select value={o.status} onChange={(e) => setAdminOrders(adminOrders.map(x => x.id === o.id ? {...x, status: e.target.value} : x))} style={{ padding: 8, borderRadius: 6, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}>
                                <option value="new">New</option>
                                <option value="accepted">Accepted</option>
                                <option value="packed">Packed</option>
                                <option value="out_for_delivery">Out for Delivery</option>
                                <option value="delivered">Delivered</option>
                                <option value="canceled">Canceled</option>
                                <option value="failed_payment">Failed Payment</option>
                                <option value="refund_request">Refund Request</option>
                              </select>
                              <button onClick={() => setMessage("Calling customer: " + o.phone)} style={{ padding: "8px 12px", background: "#0ea5e9", color: "white", border: 0, borderRadius: 6, cursor: "pointer" }}>Call Customer</button>
                              <button onClick={() => setMessage("Invoice resent to customer.")} style={{ padding: "8px 12px", background: "#475569", color: "white", border: 0, borderRadius: 6, cursor: "pointer" }}>Resend Invoice</button>
                            </div>
                          </div>
                        ))}
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
                            <div style={{ fontSize: 14, color: "#86efac", marginBottom: 12 }}>Note: {c.notes}</div>
                            <div style={{ display: "flex", gap: 10 }}>
                              <button onClick={() => setMessage(c.name + " marked for Loyalty Discount.")} style={{ padding: "8px 12px", background: "#16a34a", color: "white", border: 0, borderRadius: 6, cursor: "pointer" }}>Apply Loyalty Discount</button>
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
                        {adminAlerts.map(a => (
                          <div key={a.id} style={{ padding: 12, borderRadius: 8, background: a.type === "critical" ? "#7f1d1d" : "#9a3412", color: "white", display: "flex", justifyContent: "space-between" }}>
                            <span>{a.msg}</span>
                            <button onClick={() => setAdminAlerts(adminAlerts.filter(x => x.id !== a.id))} style={{ background: "transparent", border: 0, color: "white", cursor: "pointer", fontWeight: "bold" }}>Dismiss</button>
                          </div>
                        ))}
                        </div>
                      </div>
                    )}

                    {adminTab === "Analytics" && (
                      <div style={{ padding: 16, border: "1px solid #334155", borderRadius: 12 }}>
                        <h3 style={{ marginBottom: 12 }}>Shop Dash</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div style={{ background: "#1e293b", padding: 16, borderRadius: 8 }}>
                            <div style={{ fontSize: 14, color: "#94a3b8" }}>Today Sales</div>
                            <div style={{ fontSize: 24, fontWeight: "bold" }}>£425.50</div>
                          </div>
                          <div style={{ background: "#1e293b", padding: 16, borderRadius: 8 }}>
                            <div style={{ fontSize: 14, color: "#94a3b8" }}>Weekly Sales</div>
                            <div style={{ fontSize: 24, fontWeight: "bold" }}>£3,204.00</div>
                          </div>
                          <div style={{ background: "#1e293b", padding: 16, borderRadius: 8 }}>
                            <div style={{ fontSize: 14, color: "#94a3b8" }}>Daily Orders Count</div>
                            <div style={{ fontSize: 24, fontWeight: "bold" }}>48</div>
                          </div>
                          <div style={{ background: "#1e293b", padding: 16, borderRadius: 8 }}>
                            <div style={{ fontSize: 14, color: "#94a3b8" }}>Average Basket Value</div>
                            <div style={{ fontSize: 24, fontWeight: "bold" }}>£16.20</div>
                          </div>
                        </div>
                        
                        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div style={{ background: "#0f172a", padding: 12, borderRadius: 8, border: "1px solid #334155" }}>
                            <strong style={{ color: "#38bdf8" }}>Highest Revenue Category:</strong><br/>
                            Fruits generated highest revenue this week
                          </div>
                          <div style={{ background: "#0f172a", padding: 12, borderRadius: 8, border: "1px solid #334155" }}>
                            <strong style={{ color: "#f87171" }}>Stock Running Low:</strong><br/>
                            4 Items require restocking
                          </div>
                          <div style={{ background: "#0f172a", padding: 12, borderRadius: 8, border: "1px solid #334155" }}>
                            <strong style={{ color: "#4ade80" }}>Top Selling Product:</strong><br/>
                            Bananas
                          </div>
                          <div style={{ background: "#0f172a", padding: 12, borderRadius: 8, border: "1px solid #334155" }}>
                            <strong style={{ color: "#fbbf24" }}>Slow Moving Product:</strong><br/>
                            Frozen Peas
                          </div>
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

            <p style={{ color: "#93c5fd", marginBottom: 8 }}>
              {buyer?.mobile && orderHistory[buyer.mobile]?.length
                ? `Previous orders: ${orderHistory[buyer.mobile].length}`
                : "First order"}
            </p>

            {buyer?.mobile && orderHistory[buyer.mobile]?.length ? (
              <button
                onClick={() => {
                  const last =
                    orderHistory[buyer.mobile][orderHistory[buyer.mobile].length - 1];

                  const rebuilt = last.items
                    .split(", ")
                    .map((entry) => {
                      const [namePart, qtyPart] = entry.split(" x");
                      const product = products.find((p) => p.name === namePart);
                      return product ? { ...product, qty: Number(qtyPart) } : null;
                    })
                    .filter(Boolean) as (Product & { qty: number })[];

                  setCart(rebuilt);
                  setDeliveryAddress(last.address);
                  setMessage("Last basket restored successfully");
                }}
                style={{
                  marginBottom: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#0ea5e9",
                  color: "white",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                Reorder Last Basket
              </button>
            ) : null}

            <p style={{ color: "#94a3b8", marginBottom: 16 }}>
              Enter delivery details before payment.
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
              placeholder="Delivery address"
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
              value={checkoutEmail}
              onChange={(e) => setCheckoutEmail(e.target.value)}
              placeholder="Email for invoice / verification"
              style={{
                width: "100%", padding: 10, borderRadius: 8, marginBottom: 10,
                background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
              }}
            />

            <button
              onClick={() => {
                setEmailVerificationSent(true);
                setMessage("Mock email verification link sent");
              }}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
                background: "#475569",
                color: "white",
                border: 0,
              }}
            >
              Send Email Verification Link
            </button>

            <button
              onClick={() => {
                setPaymentOtpSent(true);
                setMessage("Mock Twilio OTP sent: 654321");
              }}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
                background: "#475569",
                color: "white",
                border: 0,
              }}
            >
              Send Phone OTP
            </button>

            {paymentOtpSent && (
              <input
                value={paymentOtp}
                onChange={(e) => setPaymentOtp(e.target.value)}
                placeholder="Enter payment OTP 654321"
                style={{
                  width: "100%", padding: 10, borderRadius: 8, marginBottom: 10,
                  background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                }}
              />
            )}

            <input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Name on card"
              style={{
                width: "100%", padding: 10, borderRadius: 8, marginBottom: 10,
                background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
              }}
            />

            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="Card number"
              style={{
                width: "100%", padding: 10, borderRadius: 8, marginBottom: 10,
                background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <input
                value={cardExpiry}
                onChange={(e) => setCardExpiry(e.target.value)}
                placeholder="MM/YY"
                style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
              />
              <input
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value)}
                placeholder="CVV"
                style={{ padding: 10, borderRadius: 8, background: "#1e293b", color: "#f8fafc", border: "1px solid #475569" }}
              />
            </div>

            <button
              onClick={() => {
                if (!deliveryAddress.trim()) {
                  setMessage("Enter delivery address before payment");
                  return;
                }
                if (!checkoutPhone.trim()) {
                  setMessage("Enter phone number for delivery updates");
                  return;
                }
                if (!checkoutEmail.trim()) {
                  setMessage("Enter email for invoice");
                  return;
                }
                if (!emailVerificationSent) {
                  setMessage("Verify email first");
                  return;
                }
                if (!paymentOtpSent || paymentOtp !== "654321") {
                  setMessage("Phone OTP validation failed");
                  return;
                }
                if (
                  !cardName.trim() ||
                  !cardNumber.trim() ||
                  !cardExpiry.trim() ||
                  !cardCvv.trim()
                ) {
                  setMessage("Enter complete card details");
                  return;
                }
                if (cardNumber.replace(/ /g, "").length !== 16) {
                  setMessage("Mock Stripe auth failed: invalid card number");
                  return;
                }
                if (cart.length === 0) {
                  setMessage("Cart is empty");
                  return;
                }

                if (buyer?.mobile) {
                  setSavedInstructions((prev) => ({
                    ...prev,
                    [buyer.mobile]: Array.from(
                      new Set([...(prev[buyer.mobile] || []), deliveryComment])
                    ),
                  }));

                  setOrderHistory((prev) => ({
                    ...prev,
                    [buyer.mobile]: [
                      ...(prev[buyer.mobile] || []),
                      {
                        total: subtotal,
                        items: cart.map((c) => `${c.name} x${c.qty}`).join(", "),
                        address: deliveryAddress,
                      },
                    ],
                  }));

                  setSavedAddresses((prev) => ({
                    ...prev,
                    [buyer.mobile]: Array.from(
                      new Set([...(prev[buyer.mobile] || []), deliveryAddress])
                    ),
                  }));

                  setAdminOrders((prev) => [
                    ...prev,
                    {
                      id: Date.now(),
                      customer: buyer.name,
                      status: "new",
                      total: subtotal,
                      items: cart.map((c) => `${c.name} x${c.qty}`).join(", "),
                      phone: buyer.mobile,
                    },
                  ]);

                  setAdminCustomers((prev) => {
                    const existing = prev.find((c) => c.phone === buyer.mobile);
                    if (existing) {
                      return prev.map((c) =>
                        c.phone === buyer.mobile
                          ? { ...c, orders: c.orders + 1, address: deliveryAddress }
                          : c
                      );
                    }
                    return [
                      ...prev,
                      {
                        id: Date.now(),
                        name: buyer.name,
                        phone: buyer.mobile,
                        address: deliveryAddress,
                        orders: 1,
                        notes: deliveryComment || "",
                        blocked: false,
                      },
                    ];
                  });
                }

                setMessage(
                  `Payment successful • card charged £${subtotal.toFixed(2)} • order placed`
                );
                setCart([]);
                setRoute("store");
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                background: "#16a34a",
                color: "white",
                border: 0,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Confirm Payment
            </button>
          </div>
        )}

        {route === "buyer" && (
          <div style={{ maxWidth: 520, flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 10, paddingBottom: 24 }}>
            <h2>Buyer UAT Login</h2>
            <p style={{ color: "#94a3b8", marginBottom: 16 }}>
              First-time users register with OTP once. Future login requires only mobile.
            </p>

            {!otpSent ? (
              <>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Buyer name (first time only)"
                  style={{
                    display: "block", padding: 12, marginBottom: 12, width: "100%", borderRadius: 10,
                    background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                  }}
                />
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Mobile number"
                  style={{
                    display: "block", padding: 12, marginBottom: 12, width: "100%", borderRadius: 10,
                    background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                  }}
                />
                <Btn
                  label={buyer ? "Login Buyer" : "Register / Send OTP"}
                  onClick={registerOrLoginBuyer}
                />
              </>
            ) : (
              <>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP (123456)"
                  style={{
                    display: "block", padding: 12, marginBottom: 12, width: "100%", borderRadius: 10,
                    background: "#1e293b", color: "#f8fafc", border: "1px solid #475569"
                  }}
                />
                <Btn label="Verify OTP" onClick={verifyOtp} />
              </>
            )}
          </div>
        )}
      </main>

      <aside style={{ padding: 20, borderLeft: "1px solid #334155", overflowY: "auto" }}>
        <h3>Cart</h3>

        {cart.length === 0 ? (
          <div>Empty</div>
        ) : (
          <>
            {cart.map((x) => (
              <div key={x.id} style={{ marginBottom: 10 }}>
                <div>
                  {x.name} x{x.qty} — £{getLineTotal(x).toFixed(2)}
                </div>

                <div style={{ color: "#86efac", fontSize: 12 }}>
                  Saving: £{getLineSavings(x).toFixed(2)}
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
            <div style={{ color: "#86efac", marginBottom: 8 }}>
              Your savings: £{totalSavings.toFixed(2)}
            </div>
            <strong>Total: £{subtotal.toFixed(2)}</strong>

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
                  border: 0,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Proceed to Payment
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}